# 📝 CEO 종합 보고서

📺 레오: 채널 분석을 위해 필요한 정보를 먼저 입력해 주세요.

1️⃣ **YouTube Data API 키**  
2️⃣ **채널 ID**  

입력이 끝나면 아래 명령어가 자동으로 실행되어 조회수, 구독자 수 및 최근 영상 데이터가 요약됩니다.  

```text
<run_command>cd "c:\Users\user\.connect-ai-brain\_company\_agents\_company\_agents\youtube\tools" && py -3 channel_full_analysis.py</run_command>
```

위 명령은 `channel_full_analysis.json`에 저장된 키와 ID를 사용해 데이터를 가져옵니다.  
입력 후 바로 확인할 수 있도록 결과가 자동으로 화면에 표시됩니다.

> 📊 채널 분석을 하려면 YouTube API 키와 채널 ID가 필요해요. 헤더 우측 "👥 직원 에이전트 보기" 버튼 → YouTube 카드 ⚙️ 클릭 → API 키와 채널 ID 입력 후 다시 요청해주세요.

📊 평가: 대기 — 사용자로부터 API 키와 채널 ID를 받아야 분석을 진행할 수 있습니다.  
📝 다음 단계: 대기 — 사용자에게 API 키와 채널 ID 입력 요청.

---
## 🛠️ 도구 실행 결과 (시스템 자동 실행)

### 🔧 실행: `cd "c:\Users\user\.connect-ai-brain\_company\_agents\_company\_agents\youtube\tools" && py -3 channe`
```
Traceback (most recent call last):
  File "c:\Users\user\.connect-ai-brain\_company\_agents\_company\_agents\youtube\tools\channel_full_analysis.py", line 304, in <module>
    main()
    ~~~~^^
  File "c:\Users\user\.connect-ai-brain\_company\_agents\_company\_agents\youtube\tools\channel_full_analysis.py", line 89, in main
    print("\u274c YOUTUBE_API_KEY�� ����־��. �ܺ� ���� �г� �� YouTube Data API ī�忡 �Է����ּ���.")
    ~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
UnicodeEncodeError: 'cp949' codec can't encode character '\u274c' in position 0: illegal multibyte sequence
```
_❌ exit 1_
