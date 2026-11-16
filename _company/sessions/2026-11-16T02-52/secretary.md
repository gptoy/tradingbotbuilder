# 📱 영숙 — 사용자에게 YouTube Data API 키와 채널 ID를 입력하도록 안내하고, 받은 정보를 기록해 주세요.

📱 영숙: 요청하신 대로 사용자에게 YouTube Data API 키와 채널 ID를 입력하도록 안내하고, 받은 정보를 기록합니다.  

**다음 단계**  
1️⃣ 사용자가 입력한 값을 받아 **`~/youtube_credentials.txt`** 파일에 저장합니다.  
2️⃣ 이후 `youtube` 에이전트에게 전달해 주세요.  

```markdown
🔹 요청 메시지 (텔레그램/채팅)
> 사장님, YouTube Data API 키와 채널 ID를 입력해 주시겠어요?  
> 예) `API_KEY: ABC123XYZ`, `CHANNEL_ID: UCxxxxxxxxxxxxx`

```

---

**파일 저장**  
(사용자가 값을 입력하면 아래 명령어로 파일을 생성/덮어씁니다.)  

```xml
<create_file path="~/youtube_credentials.txt">API_KEY: <입력값>\nCHANNEL_ID: <입력값></create_file>
```

📊 평가: 진행중 — 사용자 응답이 필요합니다.  
📝 다음 단계: 대기 — 사용자의 입력을 받아 파일에 저장하고 `youtube` 에이전트에게 전달하세요.

---
## 📁 파일 액션 결과

✅ 생성: ~\youtube_credentials.txt
