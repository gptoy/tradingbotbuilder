# 🔍 Researcher — 동종 업계 인스타그램 캠페인 트렌드 데이터 수집

🔍 Researcher: 동종 업계 인스타그램 캠페인 트렌드 데이터 수집 작업을 진행합니다.

### 1. 현재 가장 가치 있는 단일 작업
- **동종 업계(예: 식품·건강·패션 등) 인스타그램 캠페인 트렌드 데이터를 체계적으로 수집 → 분석 자료로 활용**  
  - 기존 메모리에서 유사 항목이 없으며, CEO 지시와 일치합니다.

### 2. 작업 분배
| 역할 | 담당 에이전트 | 구체적 책임 |
|------|--------------|-------------|
| **데이터 수집** | 📷 Instagram | 인스타그램 Graph API를 활용해 최근 30일 내 업계별 인기 캠페인(Hashtag, 광고 예산, 참여율 등) 메타 데이터를 추출하고 JSON/CSV로 저장. |
| **분석 및 보고** | 🔍 Researcher (본인) | 수집된 데이터 정제 후 트렌드 요약, 핵심 인사이트 도출 및 Markdown 리포트 작성. |

### 3. 실행 요청
- 📷 Instagram 에이전트에게 아래 명령을 전달합니다.

```markdown
📷 Instagram:  
1️⃣ Graph API를 사용해 지난 30일간 동종 업계(예: 식품·건강·패션)의 인스타그램 캠페인 데이터를 수집하세요.  
   - 필수 메타: campaign_id, hashtag, total_impressions, total_engagements, avg_likes, avg_comments, spend (가능 시).  
2️⃣ 결과를 `~/projects/instagram/trends/<YYYY-MM-DD>_campaign_trends.json`에 저장하고, 해당 파일 경로를 반환하세요.  

필요 API 키 및 토큰은 환경 변수에서 가져오며, `IG_APP_ID`, `IG_APP_SECRET`, `IG_ACCESS_TOKEN`을 사용합니다.  
데이터가 200개 이상이면 페이지네이션 처리해 완전하게 수집하도록 해주세요.
```

- 🔍 Researcher:  
   - 수집 완료 후 데이터 정제 및 트렌드 리포트 작성.  
   - 최종 리포트는 `~/projects/instagram/trends/<YYYY-MM-DD>_summary.md`에 저장합니다.

📊 평가: 진행중 — 작업을 실행하기 위해 Instagram 에이전트의 협조가 필요합니다.  
📝 다음 단계: 📷 Instagram 에이전트에게 데이터 수집 요청 전달.
