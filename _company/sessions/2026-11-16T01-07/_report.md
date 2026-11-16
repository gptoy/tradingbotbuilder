# 📝 CEO 종합 보고서

📺 레오: 작업 시작합니다.

사장님께서는 현재 YouTube Data API 키와 채널 ID가 필요합니다. 아래 절차를 따라 주세요:

1️⃣ **API 키 입력**  
   * Google Cloud Console → APIs & Services → Credentials에서 `YouTube Data API v3`에 대한 API 키를 생성하세요.  
   * 복사한 키는 **공개 저장소에 절대 두지 말고**, 안전하게 보관합니다.

2️⃣ **채널 ID 확인**  
   * YouTube 스튜디오 → 설정 → 고급에서 채널 ID를 찾거나, `https://www.youtube.com/channel/CHANNEL_ID` 형식으로 바로 확인하세요.

3️⃣ **키와 ID 입력**  
   * 터미널(또는 CMD)에서 아래 명령을 실행해 주세요.  
     ```bash
     cd "c:\Users\user\.connect-ai-brain\_company_agents\company_agents\youtube\tools"
     py -3 youtube_account.py
     ```
   * 스크립트가 요청하면 **YOUTUBE_API_KEY**와 **YOUTUBE_CHANNEL_ID**를 입력합니다.  
   * 입력이 완료되면 `youtube_account.json`에 저장됩니다.

4️⃣ **채널 분석 실행**  
   ```bash
   py -3 channel_full_analysis.py
   ```
   * 이 명령은 현재 설정 파일(`channel_full_analysis.json`)을 읽어 API 키와 채널 ID를 사용해 전체 분석을 수행합니다.  
   * 결과는 `sessions/2026-11-16T??-??/channel_report.md` 등에 저장됩니다.

**주의:**  
- 한 번에 한 명의 사용자만 입력하고, 다른 인원이 동시에 실행하면 충돌할 수 있습니다.  
- 스크립트가 실패하면 오류 메시지를 그대로 복사해 주세요; 추후 디버깅에 필요합니다.

📊 평가: 대기 — 사용자가 API 키와 채널 ID를 제공해야 분석이 진행됩니다.  
📝 다음 단계: 사장님께서 키와 ID를 입력하고, `youtube_account.py` 실행 결과를 알려주시길 바랍니다.
