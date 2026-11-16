# 📝 CEO 종합 보고서

📷 Instagram: 작업 시작합니다.

아래 내용을 `c:\Users\user\MelatoninApp\sessions\2026-11-16T15-00\instagram_schedule.md`에 저장하고, Meta Graph API를 통해 18:00 KST에 예약하도록 스크립트를 실행해 주세요.  

```markdown
# 📅 다음 주 릴스 일정

| 날짜 | 타이틀 | 캡션 (≤100자) | 해시태그 | 최적 게시시간 |
|------|--------|----------------|----------|--------------|
| 2026-11-21 (월) | **“가볍게 시작하기: 아침 스탠드업”** | “일상에 작은 변화를, 오늘부터! 🌞 #아침루틴 #스탠드업 #소확행 #긍정의힘 #일상Vlog” | #아침루틴 #스탠드업 #소확행 #긍정의힘 #일상Vlog | 18:00 KST |
| 2026-11-23 (수) | **“건강한 한 끼, DIY 샐러드”** | “맛있고 빠른 샐러드 레시피! 🥗 #홈쿠킹 #샐러드레시피 #헬스푸드 #다이어트식단 #간편요리” | #홈쿠킹 #샐러드레시피 #헬스푸드 #다이어트식단 #간편요리 | 18:00 KST |
| 2026-11-25 (금) | **“스트레스 해소, 5분 명상”** | “바쁜 일상 속 짧은 휴식! 🧘‍♂️ #명상 #마인드풀니스 #정신건강 #힐링타임 #자기관리” | #명상 #마인드풀니스 #정신건강 #힐링타임 #자기관리 | 18:00 KST |

> **포맷 요약**  
> - 영상 길이 : 30초 (각 주제별 핵심 메시지와 CTA 포함)  
> - 캡션 : 최대 100자, 감성 포인트 및 콜투액션(CTA) 포함  
> - 해시태그 : 최소 5개, 트렌드 + 브랜드 연관 키워드 혼합  

## 예약 스크립트 예시 (Meta Graph API)

```bash
# 가정: $META_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ID 환경 변수 세팅
curl -X POST \
  "https://graph.facebook.com/v17.0/${INSTAGRAM_BUSINESS_ID}/media" \
  -F 'image_url=https://yourcdn.com/reel1.jpg' \
  -F 'caption=일상에 작은 변화를, 오늘부터! 🌞 #아침루틴 #스탠드업 #소확행 #긍정의힘 #일상Vlog' \
  -F 'access_token=${META_ACCESS_TOKEN}' \
  -F 'video=true' \
  -F 'media_type=VIDEO' \
  -F 'scheduled_publish_time=$(date -u -d "2026-11-21 09:00 UTC" +%s)' \
  -F 'is_published=false'

# 이후 media_id를 사용해 publish
curl -X POST \
  "https://graph.facebook.com/v17.0/${INSTAGRAM_BUSINESS_ID}/media_publish" \
  -F 'creation_id=<MEDIA_ID>' \
  -F 'access_token=${META_ACCESS_TOKEN}'
```

> *위 스크립트는 예시이며, 실제 URL과 media_id를 대체해 실행하십시오.*

---

📊 평가: 완료 — 주제·캡션·해시태그·예약시간이 모두 정리되었습니다.  
📝 다음 단계: `schedule_instagram.sh` 스크립트를 최신화하고 Meta Graph API 토큰을 안전히 저장한 뒤, 자동 예약 실행 테스트를 수행하십시오.
