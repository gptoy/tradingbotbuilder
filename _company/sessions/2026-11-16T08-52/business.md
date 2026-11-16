# 💼 현빈 — PayPal API를 호출하여 지난달 거래 내역을 가져오고, 유튜브(광고, 슈퍼챗, 멤버십) 및 인스타그램(IGTV, 스폰서) 수익 데이터를 합산한 뒤 총 수입과 각 항목별 비율을 JSON 형태로 생성한다. 결과를 'reports/2026-11-16/revenue_kpi.json'에 저장하고, CSV 파일도 함께 만들어 두고, 한 줄 요약 문구를 포함하도록 한다.

💼 현빈: 작업 시작합니다.

> **데이터가 필요** – 지난달 PayPal 거래 내역을 가져오기 위해 `paypal_revenue` 도구를 실행합니다.  
> 현재 시스템에 유튜브 및 인스타그램 수익 데이터는 없으므로, 이 데이터를 먼저 확보해야 합니다.  

---

### 1️⃣ PayPal 거래 내역 가져오기
```xml
<run_command>
cd "c:\Users\user\.connect-ai-brain\_company_agents\_company_agents\business\tools" && py -3 paypal_revenue.py
</run_command>
```

> *출력은 나중에 자동으로 추가됩니다.*

---

### 2️⃣ 유튜브 & 인스타그램 수익 데이터 확보  
현재 **실시간 데이터** 섹션에는 해당 정보가 없습니다.  
따라서 **다른 에이전트에게 요청**해야 합니다.

- **유튜브 수익**: `YouTube API`로 광고, 슈퍼챗, 멤버십 수익 추출
- **인스타그램 수익**: IGTV 및 스폰서 콘텐츠 매출

> 👉 이 두 작업은 별개의 에이전트(`레오`, `Instagram`)가 담당합니다.  
> 요청 내용은 아래와 같이 명시적으로 전달하십시오.

```
[요청] 유튜브 채널(채널ID 입력)에서 지난달 광고, 슈퍼챗, 멤버십 수익을 추출해 주세요.
[요청] 인스타그램 계정에 대한 IGTV 및 스폰서 콘텐츠 매출 데이터를 제공해 주세요.
```

---

### 3️⃣ 결과 파일 작성 (완료 시)
PayPal, 유튜브, 인스타그램 데이터를 모두 수집한 뒤 다음 JSON/CSV를 생성합니다.

```json
{
  "total_revenue": <총수입>,
  "breakdown": {
    "paypal": <PayPal금액>,
    "youtube_ads": <광고수익>,
    "youtube_superchat": <슈퍼챗 수익>,
    "youtube_membership": <멤버십 수익>,
    "instagram_igtv": <IGTV 수익>,
    "instagram_sponsor": <스폰서 수익>
  },
  "percentages": {
    "paypal": "<비율>%",
    "youtube_ads": "<비율>%",
    ...
  },
  "summary": "지난달 총 매출은 $X,XXX이며 PayPal이 Y%를 차지하고 유튜브 광고가 Z%를 차지했습니다."
}
```

CSV 예시 (`reports/2026-11-16/revenue_kpi.csv`):

| 항목 | 금액 |
|------|-------|
| PayPal | $... |
| YouTube Ads | $... |
| YouTube SuperChat | $... |
| YouTube Membership | $... |
| Instagram IGTV | $... |
| Instagram Sponsor | $... |
| **총합** | **$...** |

---

### 4️⃣ 파일 저장 경로  
- JSON: `reports/2026-11-16/revenue_kpi.json`  
- CSV:  `reports/2026-11-16/revenue_kpi.csv`

> 두 파일 모두 생성한 뒤, 최종 결과를 **다른 에이전트**에게 공유합니다.

---

## 📊 평가
📊 평가: 진행중 — PayPal 데이터 수집 중이며 다른 에이전트의 수익 데이터가 필요함  

📝 다음 단계: PayPal 도구 실행 후, 유튜브와 인스타그램 수익 데이터를 요청하고 결과를 결합해 파일 저장.

---
## 🛠️ 도구 실행 결과 (시스템 자동 실행)

### 🔧 실행: `cd "c:\Users\user\.connect-ai-brain\_company_agents\_company_agents\business\tools" && py -3 paypal_`
```
������ ��θ� ã�� �� �����ϴ�.
```
_❌ exit 1_
