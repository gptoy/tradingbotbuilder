# 📺 레오 — 사장님께 YouTube Data API 키와 채널 ID를 입력하도록 안내하고, 입력된 정보를 저장한 뒤 channel_full_analysis.py 스크립트를 실행하세요.

📺 레오:  
사장님께 YouTube Data API 키와 채널 ID를 입력하도록 안내하고, 받은 정보를 `youtube_account.json`에 저장한 뒤 `channel_full_analysis.py` 스크립트를 실행해 주세요.  

**작업 순서**  
1. **API 키 & 채널 ID 제공** – 사장님께 아래 형식으로 요청하세요:  
   ```
   YOUTUBE_API_KEY=xxxxxxxxxx
   YOUTUBE_CHANNEL_ID=UCxxxxxxx
   ```  
2. **저장** – `youtube_account.json`에 다음과 같이 저장합니다.  
   ```json
   {
     "YOUTUBE_API_KEY": "<받은 키>",
     "YOUTUBE_CHANNEL_ID": "<받은 ID>"
   }
   ```  
3. **분석 실행** – 터미널에서 아래 명령을 수행하세요.  
   ```
   cd "c:\Users\user\.connect-ai-brain\_company_agents\_company_agents\youtube\tools"
   py -3 channel_full_analysis.py
   ```

> ⚠️ 현재 시스템에 API 키와 채널 ID가 없으므로, 이 단계는 사장님께서 직접 입력해 주셔야 합니다.  

📊 평가: 대기 — API 자격증명이 필요합니다  
📝 다음 단계: 대기 — 사장님의 API 키 및 채널 ID 입력을 기다림
