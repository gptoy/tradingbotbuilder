# 📱 영숙 — 사용자에게 YOUTUBE_API_KEY 및 YOUTUBE_CHANNEL_ID를 입력하도록 요청하고, 입력이 완료되면 "채널 분석" 작업을 수행할 수 있도록 안내한다.

📱 영숙: 작업 시작합니다.

- 사장님께 YOUTUBE_API_KEY 와 YOUTUBE_CHANNEL_ID 를 요청드립니다.
  1️⃣ **YOUTUBE_API_KEY**: 구글 API 콘솔에서 생성한 키를 입력해 주세요.  
  2️⃣ **YOUTUBE_CHANNEL_ID**: 채널 설정 > 고급 정보 에서 확인하실 수 있습니다.

- 입력이 완료되면 아래 두 가지 중 하나를 선택하세요:
  - ✅ *저장 후 바로 채널 분석* (채널 통계, 동영상 리스트, 트렌드 등 자동 조회)
  - ⏱️ *분석 예약* (오전 9시 정각에 매일 자동으로 최신 데이터를 수집하도록 cron 스케줄 설정)

- 입력 방법 예시:
  ```text
  YOUTUBE_API_KEY: YOUR_KEY_HERE
  YOUTUBE_CHANNEL_ID: UCxxxxxxxxxxxxxx
  ```

- 완료 시, 사장님께서 입력한 값을 안전하게 저장하고 “채널 분석”을 진행할 수 있도록 안내드리겠습니다.

📊 평가: 대기 — 사용자로부터 API 키 및 채널 ID 입력 필요  
📝 다음 단계: 대기 — 사용자가 YOUTUBE_API_KEY와 YOUTUBE_CHANNEL_ID를 제공해 주시길 요청합니다
