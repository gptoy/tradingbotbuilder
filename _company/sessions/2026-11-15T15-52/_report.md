# 📝 CEO 종합 보고서

📺 레오: 작업 시작합니다.

사장님, 유튜브 채널의 최근 30일 영상 조회수, 평균 시청시간 및 CTR 데이터를 수집하려면 **YouTube Data API 키**와 **채널 ID**가 필요합니다. 아래 정보를 입력해 주시면 자동으로 JSON 파일에 저장됩니다.

1. **API 키**: https://console.cloud.google.com/apis/credentials  
2. **채널 ID**: YouTube 동영상 URL에서 `channel/CHANNEL_ID` 부분 확인

> 🔒 보안 상 API 키와 채널 ID는 절대로 외부에 노출되지 않도록 주의해 주세요.

### 입력 예시
```text
API 키 : AIYB-xxxxxx-xxxxxxxxxxxxxxxxx
채널 ID : UCxxxxxxxxxxxxxxxxxxxx
```

입력 후, 아래 명령을 실행하면 `channel_metrics.json` 파일이 생성됩니다.

```bash
<run_command>cd "c:\Users\user\.connect-ai-brain\_company_agents\company_agents\youtube\tools" && py -3 my_videos_check.py --output channel_metrics.json</run_command>
```

**주의**: `my_videos_check.py`는 API 키와 채널 ID를 읽어 현재 30일 내 영상 데이터를 수집합니다. 파일이 정상 생성되면, 추후 분석·기획 단계에 활용할 수 있습니다.

📊 평가: 대기 — 사용자의 API 키 및 채널 ID 입력 필요  
📝 다음 단계: 사용자에게 API 키와 채널 ID 요청 후 명령 실행 안내


---
## 🛠️ 도구 실행 결과 (시스템 자동 실행)

### 🔧 실행: `cd "c:\Users\user\.connect-ai-brain\_company_agents\company_agents\youtube\tools" && py -3 my_videos`
```
������ ��θ� ã�� �� �����ϴ�.
```
_❌ exit 1_
