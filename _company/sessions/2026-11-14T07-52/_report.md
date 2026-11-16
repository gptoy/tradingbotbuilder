# 📝 CEO 종합 보고서

📺 레오: 작업 시작합니다.

## 1️⃣ YOUTUBE_API_KEY & YOUTUBE_CHANNEL_ID 입력 요청
> 사장님, YouTube Data API 키와 채널 ID를 제공해 주시면 바로 분석을 진행하겠습니다.  
> 👉 <https://console.cloud.google.com/apis/credentials> 에서 키를 확인하고,  
> 👉 `youtube_account.json`에 저장합니다.

## 2️⃣ 입력 받은 정보를 파일에 저장
```json
{
  "YOUTUBE_API_KEY": "<API_KEY>",
  "YOUTUBE_CHANNEL_ID": "<CHANNEL_ID>"
}
```

*파일 경로*: `c:\Users\user\.connect-ai-brain\_company_agents\_company_agents\youtube\tools\youtube_account.json`

## 3️⃣ 채널 전체 분석 스크립트 실행
```bash
cd "c:\Users\user\.connect-ai-brain\_company_agents\_company_agents\youtube\tools"
py -3 channel_full_analysis.py
```

**실행 명령**  
<run_command>cd "c:\Users\user\.connect-ai-brain\_company_agents\_company_agents\youtube\tools" && py -3 channel_full_analysis.py</run_command>

📊 평가: 진행중 — 분석 결과가 도착하면 리포트 생성
📝 다음 단계: 사용자로부터 API 키와 채널 ID를 입력받아 `youtube_account.json`에 저장하고, 분석 스크립트를 실행합니다.

---
## 🛠️ 도구 실행 결과 (시스템 자동 실행)

### 🔧 실행: `cd "c:\Users\user\.connect-ai-brain\_company_agents\_company_agents\youtube\tools" && py -3 channel_`
```
������ ��θ� ã�� �� �����ϴ�.
```
_❌ exit 1_
