# 📷 Instagram — 10월 20일~26일 기간 동안 최소 3개의 릴스와 3개의 피드 포스트를 위한 JSON 일정 파일을 만들고, 각 항목에 한국 표준시(KST) 예약 시간을 지정해 주세요.

📷 Instagram: 작업 시작합니다.

```json
{
  "schedule_date": "2026-10-20 to 2026-10-26",
  "timezone": "KST",
  "posts": [
    {
      "id": "reel_01",
      "type": "reel",
      "title": "DIY 홈데코 팁 #1",
      "scheduled_time": "2026-10-20T18:00:00+09:00"
    },
    {
      "id": "reel_02",
      "type": "reel",
      "title": "스마트 라이트 활용법",
      "scheduled_time": "2026-10-22T19:30:00+09:00"
    },
    {
      "id": "reel_03",
      "type": "reel",
      "title": "바쁜 아침을 위한 5분 정리",
      "scheduled_time": "2026-10-24T17:45:00+09:00"
    },
    {
      "id": "feed_01",
      "type": "feed",
      "title": "주말 인테리어 트렌드 스냅샷",
      "scheduled_time": "2026-10-21T15:30:00+09:00"
    },
    {
      "id": "feed_02",
      "type": "feed",
      "title": "가정용 커피 머신 리뷰",
      "scheduled_time": "2026-10-23T12:00:00+09:00"
    },
    {
      "id": "feed_03",
      "type": "feed",
      "title": "새벽 운동 루틴과 공간 활용 팁",
      "scheduled_time": "2026-10-26T08:15:00+09:00"
    }
  ]
}
```

<create_file path="c:\Users\user\MelatoninApp\sessions\2026-11-16T13-07\instagram_schedule_2026-10-20_to_26.json">
{
  "schedule_date": "2026-10-20 to 2026-10-26",
  "timezone": "KST",
  "posts": [
    {
      "id": "reel_01",
      "type": "reel",
      "title": "DIY 홈데코 팁 #1",
      "scheduled_time": "2026-10-20T18:00:00+09:00"
    },
    {
      "id": "reel_02",
      "type": "reel",
      "title": "스마트 라이트 활용법",
      "scheduled_time": "2026-10-22T19:30:00+09:00"
    },
    {
      "id": "reel_03",
      "type": "reel",
      "title": "바쁜 아침을 위한 5분 정리",
      "scheduled_time": "2026-10-24T17:45:00+09:00"
    },
    {
      "id": "feed_01",
      "type": "feed",
      "title": "주말 인테리어 트렌드 스냅샷",
      "scheduled_time": "2026-10-21T15:30:00+09:00"
    },
    {
      "id": "feed_02",
      "type": "feed",
      "title": "가정용 커피 머신 리뷰",
      "scheduled_time": "2026-10-23T12:00:00+09:00"
    },
    {
      "id": "feed_03",
      "type": "feed",
      "title": "새벽 운동 루틴과 공간 활용 팁",
      "scheduled_time": "2026-10-26T08:15:00+09:00"
    }
  ]
}
</create_file>

📊 평가: 완료 — JSON 일정 파일을 생성하고 저장했습니다.  
📝 다음 단계: 인스타그램 Graph API를 통해 예약 요청 스크립트 실행(코다리 에이전트에게 전달).

---
## 📁 파일 액션 결과

✅ 생성: c:\Users\user\MelatoninApp\sessions\2026-11-16T13-07\instagram_schedule_2026-10-20_to_26.json
