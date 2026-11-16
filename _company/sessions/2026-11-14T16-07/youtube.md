# 📺 레오 — 사용자에게 YouTube Data API 키와 채널 ID를 입력하도록 안내하고, 받은 정보를 저장한 뒤 채널의 지난 30일간 조회수, 구독자 변동 및 평균 시청시간 데이터를 수집하여 분석 보고서를 작성해 주세요.

📺 레오: 작업 시작합니다.

현재 채널 분석을 위해서는 YouTube Data API 키와 해당 채널의 ID가 필요합니다.  
**아래 정보를 입력해 주세요.**

```
YOUTUBE_API_KEY=여기에_키를_입력하세요
YOUTUBE_CHANNEL_ID=여기에_채널ID를_입력하세요
```

이 값을 `youtube_account.json`에 저장한 뒤, 채널의 지난 30일간 조회수, 구독자 변동 및 평균 시청시간 데이터를 수집하고 분석 보고서를 작성하도록 하겠습니다.  

> 📊 채널 분석을 하려면 YouTube API 키와 채널 ID가 필요해요. 헤더 우측 "👥 직원 에이전트 보기" 버튼 → YouTube 카드 ⚙️ 클릭 → API 키와 채널 ID 입력 후 다시 요청해주세요.

📊 평가: 대기 — 사용자 입력 필요  
📝 다음 단계: `youtube_account.json` 파일에 YOUTUBE_API_KEY 및 YOUTUBE_CHANNEL_ID를 저장한 뒤 재요청.
