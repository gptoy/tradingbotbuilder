# 📝 CEO 종합 보고서

📺 레오: 작업 시작합니다.

현재 상황에서는 YOUTUBE_API_KEY와 YOUTUBE_CHANNEL_ID가 설정되지 않았습니다.  
이 정보를 입력해 주시면 최근 30일 동안의 영상 조회수, 평균 시청시간(분), CTR 데이터를 수집해 `channel_recent_metrics.json` 파일에 저장하도록 진행하겠습니다.

**필요한 정보**

| 항목 | 예시 |
|------|-------|
| YOUTUBE_API_KEY | `AIzaSyA...` |
| YOUTUBE_CHANNEL_ID | `UCxxxxxxxxxxxxxx` |

> 📊 채널 분석을 하려면 YouTube API 키와 채널 ID가 필요해요. 헤더 우측 "👥 직원 에이전트 보기" 버튼 → YouTube 카드 ⚙️ 클릭 → API 키와 채널 ID 입력 후 다시 요청해주세요.

📊 평가: 대기 — 사용자의 인증 정보 제공 필요  
📝 다음 단계: 사용자로부터 YOUTUBE_API_KEY 및 YOUTUBE_CHANNEL_ID를 받아, `youtube_account.json`에 저장하고 데이터 수집 스크립트 실행을 준비합니다
