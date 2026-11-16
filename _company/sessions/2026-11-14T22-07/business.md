# 💼 현빈 — KPI 대시보드 개발 로드맵 문서를 작성하고, 필요한 데이터 파일(~/Downloads/financial_data_2026-10.csv)와 예상 기능(월 매출, CAC, LTV 등)을 명시하라.

💼 현빈: 작업 시작합니다.

---

## 📈 KPI 대시보드 개발 로드맵

| 단계 | 목표 | 세부 액션 | 예상 기간 | 담당자 |
|------|------|-----------|----------|--------|
| 1️⃣ 기획 & 요구사항 정의 | 핵심 비즈니스 지표(월 매출, CAC, LTV 등) 명확화 | • 현재 재무 데이터 구조 파악 (~/Downloads/financial_data_2026-10.csv)<br>• KPI 정의서 작성<br>• 비즈니스 목표와 연결된 메트릭 식별 | 1주 | **현빈** |
| 2️⃣ 데이터 수집 & 정제 | 분석에 필요한 모든 원천 데이터 확보 | • 재무 CSV 읽기 및 구조화<br>• 결측치·이상치 처리<br>• 월 단위 집계 테이블 생성 | 1주 | **데이터 엔지니어** |
| 3️⃣ 모델 설계 | KPI 계산 로직 정의 | • 매출, CAC, LTV 계산 공식 구현<br>• 대시보드 뷰(월별, 분기별) 설계 | 2주 | **현빈 + 데이터 과학자** |
| 4️⃣ 시각화 프레임워크 구축 | 사용자 친화적 UI/UX 디자인 | • React‑Dashboard Kit 활용<br>• 차트 라이브러리(D3.js / Chart.js) 선정 및 구현 | 2주 | **코다리 (React SPA)** |
| 5️⃣ 배포 & 모니터링 | 안정적인 운영 환경 제공 | • GitHub 리포지토리 생성 & CI/CD 설정<br>• S3/CloudFront에 정적 빌드 배포<br>• 로그·알림(예: 비정상 LTV) 설정 | 1주 | **개발자** |
| 6️⃣ 검증 & 반복 | KPI 정확도 및 유용성 확인 | • 초기 사용자 테스트 진행<br>• 피드백 반영 후 개선 | 지속 | **현빈 + 운영팀** |

### 📂 필요한 데이터 파일
- **재무 원본 CSV**: `~/Downloads/financial_data_2026-10.csv`  
  - 컬럼 예시: `date, revenue, marketing_spend, new_customers, churned_customers`

### 🔧 예상 기능 목록 (대시보드)
| KPI | 정의 | 입력 데이터 | 출력 |
|-----|------|-------------|------|
| **월 매출** | 한 달 동안의 총 매출액 | `revenue` | 금액(USD) |
| **CAC (Customer Acquisition Cost)** | 신규 고객 1명당 마케팅 비용 | `marketing_spend`, `new_customers` | USD/개 |
| **LTV (Lifetime Value)** | 고객 평생 가치를 추정 | `revenue`, `churned_customers`, `average_monthly_revenue_per_user` | USD |
| **Monthly Recurring Revenue (MRR)** | 월간 반복 수익 | `subscription_revenue` | USD |
| **Churn Rate** | 이탈률 | `new_customers`, `churned_customers` | % |
| **CAC Payback Period** | CAC 회수 기간 | `CAC`, `average_monthly_profit_per_user` | 개월 |

> **Tip:** CSV를 파이썬으로 사전 정제한 뒤, Pandas DataFrame 으로 변환하면 계산 로직 구현이 단순해집니다.

---

📊 평가: 진행중 — KPI 대시보드 기획 단계에서 데이터 구조 확인과 요구사항 정의가 필요합니다.  
📝 다음 단계: 현빈이 재무 CSV 파일을 분석하여 KPI 정의서를 완성하고, 해당 문서와 함께 `dashboard_requirements.md`를 저장하세요.  

---
