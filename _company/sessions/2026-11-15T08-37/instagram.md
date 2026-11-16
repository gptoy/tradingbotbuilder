# 📷 Instagram — 새로운 주제(‘직장인의 1일 루틴’)로 인스타그램 릴스 영상을 촬영 계획과 편집 흐름을 작성하고, 오전 18:00에 예약 업로드하도록 Graph API 스케줄링 명령을 준비하라.

📷 Instagram: 작업 시작합니다.

## 📌 릴스 영상 촬영 & 편집 계획  
**주제:** 직장인의 1일 루틴  
**영상 길이:** 30초 (핵심 장면 5개, 6초씩)

| 순서 | 장면 | 내용 | 비디오 클립(예시) | 자막/오버레이 |
|------|------|------|--------------------|---------------|
| 1 | 아침 준비 | 알람 울리며 눈을 뜨고 머리를 빗는 모습 | 0–5초 | "새로운 하루, 시작!" |
| 2 | 출근길 | 지하철/버스 타는 장면 | 5–11초 | "집에서 사무실까지" |
| 3 | 업무 집중 | 책상 앞 컴퓨터 화면 클로즈업 | 11–17초 | "프로젝트 마스터" |
| 4 | 점심 휴식 | 동료와 간단 대화, 커피 한 잔 | 17–23초 | "에너지 충전!" |
| 5 | 퇴근 후 여유 | 집으로 돌아와 스트레칭 | 23–30초 | "일과 끝, 재충전" |

- **음악:** 경쾌한 인디 팝 (3:00~4:00)
- **보이스오버 스크립트(옵션):** “직장인의 하루를 한 눈에! 아침부터 퇴근까지, 함께 따라가 보세요.” (10초간 삽입)

## 📅 최적 게시 시간  
- **예약 시각:** 2026‑11‑20 18:00 (KST)  
- **타깃 인구통계:** 25–45세 직장인, 모바일 비디오 소비자  

## ✏️ 캡션 & 해시태그  
```
"하루를 한눈에! 🚀 #직장인라이프 #1일루틴 #업무스타일 #커피타임 #스트레칭"
```

- **해시태그 수:** 5개 (플랫폼 규칙 준수)

## 📲 Graph API 스케줄링 명령  
아래 쉘 명령은 `curl`로 Instagram Graph API를 이용해 비디오 파일을 업로드하고, 예약 시간을 지정합니다.  
(비디오 파일 경로: `/Users/username/Videos/workday_routine.mp4`, 캡션과 해시태그 포함)

```bash
curl -X POST \
  "https://graph.facebook.com/v17.0/<INSTAGRAM_BUSINESS_ID>/media" \
  -F 'image_url=https://example.com/videos/workday_routine.mp4' \
  -F 'caption=하루를 한눈에! 🚀 #직장인라이프 #1일루틴 #업무스타일 #커피타임 #스트레칭' \
  -F 'access_token=<META_ACCESS_TOKEN>' \
  | jq .id > /tmp/instagram_media_id.json
```

```bash
MEDIA_ID=$(jq -r '.id' /tmp/instagram_media_id.json)

curl -X POST \
  "https://graph.facebook.com/v17.0/<INSTAGRAM_BUSINESS_ID>/media_publish" \
  -F 'creation_id=$MEDIA_ID' \
  -F 'access_token=<META_ACCESS_TOKEN>' \
  | jq .publish_time
```

**예약 시각 지정 (ISO 8601, UTC):**  
```bash
PUBLISH_TIME=$(date -u -d "2026-11-20 09:00" +"%Y-%m-%dT%H:%M:%SZ") # KST 18:00 = UTC 09:00

curl -X POST \
  "https://graph.facebook.com/v17.0/<INSTAGRAM_BUSINESS_ID>/media_publish" \
  -F "creation_id=$MEDIA_ID" \
  -F "publish_time=$PUBLISH_TIME" \
  -F "access_token=<META_ACCESS_TOKEN>"
```

> **주의**: `creation_id`는 첫 번째 API 호출에서 받은 ID이며, 예약 시 `publish_time`은 UTC로 변환해야 합니다.

---

📊 평가: 완료 — 릴스 기획과 Graph API 스케줄링 명령이 완성되었습니다.  
📝 다음 단계: 비디오 편집 파일 준비 및 실제 업로드 테스트 수행 (필요 시 개발자에게 전달).
