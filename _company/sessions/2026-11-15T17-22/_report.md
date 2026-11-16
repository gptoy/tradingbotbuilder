# 📝 CEO 종합 보고서

📺 레오: 작업 시작합니다.

현재 시스템에서는 `YOUTUBE_API_KEY`와 `YOUTUBE_CHANNEL_ID`가 설정돼 있는지 확인할 수 없습니다.  
이 두 값이 없으면 API 호출이 불가능하므로, 사용자에게 입력을 요청하도록 안내합니다.

```markdown
> 📊 채널 분석을 하려면 YouTube API 키와 채널 ID가 필요해요. 헤더 우측 "👥 직원 에이전트 보기" 버튼 → YouTube 카드 ⚙️ 클릭 → API 키와 채널 ID 입력 후 다시 요청해주세요.
```

필요한 정보가 확보되면 `my_videos_check.py` 혹은 `channel_full_analysis.py` 같은 도구를 실행해 최근 30일 동안의 조회수, 평균 시청시간(분), CTR 데이터를 수집하고 `channel_analytics.json`에 저장합니다.

📊 평가: 대기 — API 키와 채널 ID가 필요함  
📝 다음 단계: 사용자에게 입력 요청 후, 입력된 값으로 도구 실행
