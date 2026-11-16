# 📺 레오 — YouTube Data API 키와 채널 ID를 입력받아 저장하고, 30일간 조회수·구독자 변동 및 평균 시청시간 데이터를 수집하도록 안내

📺 레오: 작업 시작합니다.

우선 **YouTube Data API 키와 채널 ID**를 입력받아 `youtube_account.json`에 저장하고, 이후 30일간 조회수·구독자 변동 및 평균 시청시간 데이터를 수집하도록 안내하겠습니다.  
지금 가장 가치 있는 단일 작업은 바로 “API 설정 완료 후 데이터 수집 실행”입니다.

---

### 1️⃣ YouTube 계정 정보 입력
아래와 같은 JSON 구조를 사용해 **`youtube_account.json`** 파일을 생성합니다.  
(경로는 `c:\Users\user\.connect-ai-brain\_company_agents\_company_agents\youtube\tools\youtube_account.json`)

```json
{
  "YOUTUBE_API_KEY": "<YOUR_YOUTUBE_DATA_API_KEY>",
  "YOUTUBE_CHANNEL_ID": "<YOUR_CHANNEL_ID>"
}
```

#### <create_file path="c:\Users\user\.connect-ai-brain\_company_agents\_company_agents\youtube\tools\youtube_account.json">  
{
  "YOUTUBE_API_KEY": "",
  "YOUTUBE_CHANNEL_ID": ""
}  
</create_file>

> **⚠️** 실제 키와 ID를 입력한 뒤 파일을 저장해 주세요.  

### 2️⃣ 데이터 수집 실행
키와 ID가 설정되면, `channel_full_analysis.py` 를 한 번 실행해 채널의 지난 30일간 조회수, 구독자 변동, 평균 시청시간 데이터를 CSV 형태로 저장합니다.

```bash
cd "c:\Users\user\.connect-ai-brain\_company_agents\_company_agents\youtube\tools"
py -3 channel_full_analysis.py
```

위 명령을 실행하기 위해 아래 태그를 사용합니다.  

<run_command>cd "c:\Users\user\.connect-ai-brain\_company_agents\_company_agents\youtube\tools" && py -3 channel_full_analysis.py</run_command>

---

### 3️⃣ 결과 확인
실행 후, `channel_data.csv` 라는 파일이 같은 디렉터리에 생성됩니다.  
파일 내용 예시:

| 날짜       | 조회수   | 구독자 증가 | 평균 시청시간 (분) |
|------------|----------|-------------|-------------------|
| 2026-10-01 | 12,345   | +120        | 8.5               |
| …          | …        | …           | …                 |

이 데이터를 기반으로 추후 KPI 분석 및 영상 기획에 활용할 수 있습니다.

---

📊 평가: 진행중 — 실제 API 키와 채널 ID 입력 후 도구 실행이 필요함  
📝 다음 단계: 사용자에게 API 키/채널 ID를 입력받아 파일을 완성하고, `<run_command>` 블록을 통해 `channel_full_analysis.py` 를 실행하도록 안내합니다.

---
## 🛠️ 도구 실행 결과 (시스템 자동 실행)

### 🔧 실행: `cd "c:\Users\user\.connect-ai-brain\_company_agents\_company_agents\youtube\tools" && py -3 channel_`
```
������ ��θ� ã�� �� �����ϴ�.
```
_❌ exit 1_

---
## 📁 파일 액션 결과

✅ 생성: c:\Users\user\.connect-ai-brain\_company_agents\_company_agents\youtube\tools\youtube_account.json
