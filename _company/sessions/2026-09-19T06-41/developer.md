# 💻 코다리 — business 에이전트가 정의한 요구사항을 바탕으로, PayPal API 연동 로직과 티어별 결제 상태(Subscription/One-time)에 따른 권한 제어를 위한 데이터베이스 스키마 및 백엔드 아키텍처 설계안을 작성하세요.

💻 코다리: 작업 시작합니다. 

CEO 지시 사항 확인했습니다. `business` 에이전트(현빈)가 설계한 **Decoy Pricing 전략($29 Pro 티어 유도)**을 기술적으로 뒷받침하기 위해서는, 결제 상태에 따라 API 권한을 즉각적이고 정교하게 제어할 수 있는 **Webhook 기반의 Event-driven 아키텍처**가 필수적입니다. 

단순히 '결제 완료'만 체크하는 게 아니라, 구독 만료(Churn), 결제 실패(Past Due) 등 다양한 상태 변화를 시스템이 스스로 감지하고 권한을 회수/부여할 수 있도록 설계하겠습니다.

---

# 🏗️ PayPal 연동 및 티어별 권한 제어 아키텍처 설계안

## 1. 시스템 아키텍처 개요 (High-Level)
결제 프로세스는 **'사용자 요청 $\rightarrow$ PayPal 결제 $\rightarrow$ Webhook 수신 $\rightarrow$ DB 업데이트 $\rightarrow$ 권한 즉시 반영'**의 흐름을 따릅니다.

*   **Backend Framework:** FastAPI (Python) - 비동기 처리에 최적화되어 Webhook 대량 수신 및 API 응답 속도 확보.
*   **Database:** PostgreSQL - 트랜잭션 무결성(ACID) 보장을 위해 결제/구독 데이터 관리.
*   **Task Queue:** Redis + Celery - PayPal Webhook 수신 후 발생하는 무거운 작업(이메일 발송, 권한 동기화, 리소스 재할당)을 비동기로 처리하여 API 응대 지연 방지.

## 2. 데이터베이스 스키마 설계 (PostgreSQL)
결제 상태와 기능 권한을 분리하여, 구독 모델($29/mo)과 일회성 모델(VIP 서비스)을 동시에 수용할 수 있도록 설계합니다.

```sql
-- 1. 사용자 및 기본 등급 정보
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    subscription_level VARCHAR(20) NOT NULL, -- 'FREE', 'PRO', 'VIP'
    status VARCHAR(20) DEFAULT 'ACTIVE',     -- 'ACTIVE', 'SUSPENDED', 'CANCELED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 구독/결제 상세 정보 (Subscription & One-time)
CREATE TABLE subscriptions (
    sub_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    paypal_subscription_id VARCHAR(255),      -- PayPal에서 발급한 구독 ID
    plan_type VARCHAR(20) NOT NULL,          -- 'RECURRING' (Pro), 'ONE_TIME' (VIP)
    status VARCHAR(20) NOT NULL,             -- 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH NULL,             -- 구독형은 만료일 존재, 일회성은 NULL 또는 영구
    current_period_end TIMESTAMP WITH TIME ZONE, -- 다음 결제 예정일
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 결제 이력 (Audit Log)
CREATE TABLE payment_logs (
    payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    transaction_id VARCHAR(255) UNIQUE NOT NULL, -- PayPal Transaction ID
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    payment_type VARCHAR(20),                  -- 'SUBSCRIPTION', 'ONE_TIME'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 3. PayPal Webhook 연동 로직 (Event-Driven)
PayPal의 `IPN(Instant Payment Notification)` 또는 최신 `Webhooks`를 사용하여 서버가 결제 상태 변화를 능동적으로 수신합니다.

### 핵심 처리 이벤트 (Event Types)
1.  **`BILLING.SUBSCRIPTION.CREATED`**: 구독 생성 시 $\rightarrow$ `users.subscription_level`을 'PRO'로 업데이트.
2.  **`PAYMENT.SALE.COMPLETED`**: 결제 성공 시 $\rightarrow$ `payment_logs` 기록 및 서비스 이용 기간 연장.
3.  **`BILLING.SUBSCRIPTION.CANCELLED`**: 사용자가 구독 취소 시 $\rightarrow$ 상태를 'CANCELED'로 변경하되, `end_date`까지는 기능 유지 (중요: UX 차원).
4.  **`PAYMENT.SALE.DENIED` / `BILLING.SUBSCRIPTION.PAYMENT.FAILED`**: 결제 실패 시 $\rightarrow$ 즉시 `subscription_level`을 'FREE'로 강등 및 알림 발송.

### Webhook Handler Pseudo-code (FastAPI)
```python
@app.post("/webhooks/paypal")
async def paypal_webhook_handler(payload: dict, signature: str = Header(...)):
    # 1. 보안 검증: PayPal 서명 검증 필수 (Signature Verification)
    if not verify_paypal_signature(payload, signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = payload["event_type"]
    data = payload["resource"]

    # 2. 이벤트별 로직 분기
    if event_type == "BILLING.SUBSCRIPTION.CREATED":
        await update_user_subscription(data["subscriber"], "PRO")
    
    elif event_type == "PAYMENT.SALE.COMPLETED":
        await record_transaction(data)
        # 일회성 결제(VIP)인 경우 권한 영구 부여 로직 수행

    elif event_type in ["BILLING.SUBSCRIPTION.PAYMENT.FAILED", "BILLING.SUBSCRIPTION.CANCELLED"]:
        await downgrade_user_access(data["subscriber"])

    return {"status": "success"}
```

## 4. 권한 제어 메커니즘 (Access Control)
모든 API 엔드포인트는 미들웨어를 통해 사용자의 `subscription_level`을 검증합니다.

*   **Middleware Pattern**:
    *   `Automation Feature`: `if user.subscription_level not in ['PRO', 'VIP']: raise Forbidden()`
    *   `Premium Template Access`: `if user.subscription_app_level != 'VIP': raise Forbidden()`
*   **Granular Permission (Bitmask/Role-based)**: 
    사용자 세션(JWT)에 현재 권한 정보를 포함시켜 DB 부하를 줄이되, 결제 상태 변경 시에는 즉시 토큰을 무효화하거나 재발급하도록 설계합니다.

## 5. 검증 및 안정성 대책 (Senior's Checklist)
*   **Idempotency (멱등성)**: 동일한 Webhook이 네트워크 지연으로 두 번 들어와도 결제 로그가 중복 생성되지 않도록 `transaction_id`를 유니크 키로 사용합니다. ⚙️
*   **Race Condition**: 결제 처리 중 동시에 여러 요청이 올 경우를 대비해 DB 레벨의 `SELECT FOR UPDATE` (Pessimistic Locking) 적용을 고려합니다. 🔒
*   **Reconciliation (대조 작업)**: 하루에 한 번, PayPal API를 통해 전체 구독 상태와 우리 DB 상태를 동기화하는 배치(Batch) 작업을 수행하여 데이터 불일치를 방지합니다. ✅

---

📊 평가: 완료 — 요구사항에 명시된 결제 연동 및 권한 제어를 위한 DB 스키마, 아키텍처, 보안 로직을 설계함.
📝 다음 단계: 위 설계를 바탕으로 실제 FastAPI 기반의 PayPal Webhook 수신 모듈 프로토타입 개발 시작.
