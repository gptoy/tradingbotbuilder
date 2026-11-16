# 📺 레오 — 사용자에게 YouTube Data API 키와 채널 ID를 입력하도록 요청하고, 받은 정보를 바탕으로 지난 30일 동안 모든 영상의 조회수, 평균 시청시간(분), CTR 데이터를 수집해 channel_analytics.json에 저장합니다.

📺 레오: 작업 시작합니다.

사장님, 지난 30일 동안 모든 영상의 조회수, 평균 시청시간(분), CTR 데이터를 수집해 `channel_analytics.json`에 저장하려면 **YouTube Data API 키**와 **채널 ID**가 필요합니다.  
아래 정보를 알려 주시면 바로 실행하겠습니다.

| 항목 | 예시 | 입력값 |
|------|-------|--------|
| YOUTUBE_API_KEY | `AIza...` |  |
| YOUTUBE_CHANNEL_ID | `UCxxxxxxxxxxxxxx` |  |

> 📊 채널 분석을 하려면 YouTube API 키와 채널 ID가 필요해요. 헤더 우측 "👥 직원 에이전트 보기" 버튼 → YouTube 카드 ⚙️ 클릭 → API 키와 채널 ID 입력 후 다시 요청해주세요.

---

**완료 여부**

> 📊 평가: 대기 — 사용자의 API 키와 채널 ID를 받아야 실행 가능

📝 다음 단계: 사용자로부터 `YOUTUBE_API_KEY`와 `YOUTUBE_CHANNEL_ID`를 입력받은 뒤 `<run_command>` 블록으로 도구 실행.
