# 📱 영숙 — 사용자에게 YouTube Data API 키와 채널 ID를 입력받도록 안내하고, 받은 정보를 저장해 두고 이후에 channel_full_analysis.py 실행 준비를 하세요.

📱 영숙: 작업 시작합니다.

## 1️⃣ 사용자에게 요청
사장님께 아래 메시지를 전달해 주세요.  
(Telegram, 메일 등 원하는 채널에서 보내시면 됩니다.)

```
안녕하세요 사장님! 📺 YouTube Data API 사용을 위해
- **API 키** (예: `AIzaSy...`) 
- **채널 ID** (예: `UCxxxxxx`)

를 입력해 주시면 저장 후 분석 준비 완료하도록 하겠습니다. 🙏
```

## 2️⃣ 받은 정보를 파일에 저장  
받은 값이 전달되면, 아래와 같이 세션 폴더에 Markdown 파일을 생성합니다.

```markdown
# YouTube API Credentials

API_KEY: <API키>
CHANNEL_ID: <채널ID>

Created at: <timestamp>
```

**실제 명령어**

```xml
<create_file path="sessions/2026-11-14T12-52/youtube_credentials.md">
# YouTube API Credentials

API_KEY: 
CHANNEL_ID: 

Created at: 2026-11-14T12:52
</create_file>
```

> *파일 경로는 현재 세션 날짜와 시간에 맞춰 자동으로 업데이트 됩니다.*

## 3️⃣ `channel_full_analysis.py` 준비  
파일이 저장되면, 분석 스크립트 실행을 위해 다음과 같이 커맨드 라인에서 호출합니다.

```xml
<run_command>python channel_full_analysis.py --cred sessions/2026-11-14T12-52/youtube_credentials.md</run_command>
```

---

📊 평가: 진행중 — 사용자 입력이 필요해 후속 단계가 대기 중  
📝 다음 단계: 사용자가 API 키와 채널 ID를 제공하면 파일에 저장하고 스크립트 실행 준비 완료.

---
## 🛠️ 도구 실행 결과 (시스템 자동 실행)

### 🔧 실행: `python channel_full_analysis.py --cred sessions/2026-11-14T12-52/youtube_credentials.md`
```
python: can't open file 'c:\\Users\\user\\.connect-ai-brain\\_company\\_agents\\_company\\_agents\\secretary\\tools\\channel_full_analysis.py': [Errno 2] No such file or directory
```
_❌ exit 2_

---
## 📁 파일 액션 결과

✅ 생성: c:\Users\user\MelatoninApp\sessions\2026-11-14T12-52\youtube_credentials.md
