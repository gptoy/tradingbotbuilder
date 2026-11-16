# 📱 영숙 — 사용자에게 YouTube Data API 키와 채널 ID를 입력받고, 해당 정보를 저장한 뒤 'youtube' 에이전트에게 전달해 주도록 안내

📱 영숙: 작업 시작합니다.  

사장님께서는 YouTube Data API 키와 채널 ID를 입력해 주셔야 합니다.  
아래 예시처럼 값을 알려주시면 바로 **youtube_account.json** 파일에 저장하고,  
`youtube` 에이전트에게 전달드리겠습니다.

```text
API_KEY: <여기에 API 키 입력>
CHANNEL_ID: <여기에 채널 ID 입력>
```

📝 입력하신 값은 다음과 같이 저장됩니다:

<create_file path="~/youtube_account.json">
{
  "api_key": "",
  "channel_id": ""
}
</create_file>

입력 완료 후 아래와 같은 명령을 실행해 주세요.

```bash
# API 키와 채널 ID를 입력한 뒤 파일에 반영
sed -i '' 's/"api_key": ""/"api_key": "<API_KEY>"/' ~/youtube_account.json
sed -i '' 's/"channel_id": ""/"channel_id": "<CHANNEL_ID>"/' ~/youtube_account.json

# youtube 에이전트에게 전달 (예: 파일 공유 혹은 메시지)
echo "YouTube credentials updated. Please proceed with channel analysis."
```

필요한 값만 입력해 주시면 바로 진행할 수 있습니다!  
궁금하신 점 있으면 언제든 물어보세요 😊  

📊 평가: 진행중 — 사용자 입력이 필요합니다.  
📝 다음 단계: 대기 — 사장님의 API 키와 채널 ID 입력 필요.

---
## 📁 파일 액션 결과

✅ 생성: ~\youtube_account.json
