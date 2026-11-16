# 📝 CEO 종합 보고서

📱 영숙: 작업 시작합니다.

### 요청
사장님, YouTube Data API 키와 채널 ID를 입력해 주시면 안전하게 저장하겠습니다.  
- **API 키**: `https://developers.google.com/analytics/devguides/reporting/core/v4/getting_started` 에서 발급받은 값  
- **채널 ID**: YouTube 페이지에서 “내 채널 ID” 확인  

입력 예시:
```
YOUTUBE_API_KEY=YOUR_API_KEY
YOUTUBE_CHANNEL_ID=YOUR_CHANNEL_ID
```

### 저장 경로
보안상 `~/.config/youtube/api_keys.json`에 JSON 형식으로 보관합니다. 파일이 없으면 새로 생성하고, 있으면 덮어씁니다.

```markdown
<create_file path="~/.config/youtube/api_keys.json">
{
  "api_key": "<입력받은 API 키>",
  "channel_id": "<입력받은 채널 ID>"
}
</create_file>
```

> **주의**: 파일 권한을 `600`으로 설정해 외부 접근을 차단합니다.

📊 평가: 진행중 — 사용자 입력 필요  
📝 다음 단계: 사장님이 API 키와 채널 ID를 제공하면 저장 완료하겠습니다.

---
## 📁 파일 액션 결과

✅ 생성: ~\.config\youtube\api_keys.json
