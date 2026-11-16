# 📷 Instagram — 릴스 콘텐츠 일정표를 설계하고, 주간 게시물별 타깃 해시태그 및 최적 포스팅 시간을 추천. 개발자에게 API 엔드포인트와 매개변수 안내.

📷 Instagram: 작업 시작합니다.

## 📅 주간 릴스 콘텐츠 일정표 (2026‑11‑20 ~ 2026‑11‑24)

| 요일 | 제목 / 컨셉 | 포스팅 시간(현지) | 타깃 해시태그 (5개) | 핵심 CTA |
|------|-------------|-------------------|-----------------------|-----------|
| 월요일 | “AI가 바꾸는 홈데코” 30초 튜토리얼 | **18:00** | #인테리어 #홈데코 #DIY #AI컨설팅 #스마트라이프 | ‘팔로우 후 더 많은 팁 보기’ |
| 화요일 | “EcoBottle 사용 후기” 15초 리뷰 | **20:30** | #친환경 #EcoBottle #수분충전 #지속가능한생활 #플라스틱제로 | ‘댓글에 사용 경험 공유!’ |
| 수요일 | “AI 툴 AICraft 데모” 45초 빠른 가이드 | **19:15** | #AICraft #인공지능툴 #생산성업그레이드 #크리에이터필수 #프리미엄AI | ‘바로 사용해 보기’ |
| 목요일 | “30초 인테리어 팁” 30초 스니펫 | **17:45** | #인테리어팁 #홈스타일링 #DIY집꾸미기 #데코아이디어 #집안정리 | ‘좋아요와 공유 부탁해요!’ |
| 금요일 | “주말 준비 – AI 챗봇 활용법” 60초 | **18:30** | #챗봇 #AI가이드 #주말플래너 #스마트라이프 #일상혁신 | ‘댓글에 주말 계획 남겨봐요’ |

> **게시 시간 선정 근거**  
> - 인스타그램 사용자 활동 피크는 17:00‑20:00 사이 (특히 주중 오후)이며, **월·수·금은 18:00‑19:30**, **화·목은 20:00‑21:00** 로 설정했습니다.  
> - 해시태그는 최신 트렌드와 제품명(‘EcoBottle’, ‘AICraft’)을 혼합해 타깃 오디언스에게 도달성을 극대화합니다.

---

## 📡 Instagram Graph API 엔드포인트 & 매개변수

| 엔드포인트 | HTTP 메서드 | 필수 파라미터 | 비고 |
|-------------|------------|--------------|------|
| `/v15.0/{IG-USER-ID}/media` | POST | `image_url`, `caption` | 이미지 업로드 후 바로 게시 (릴스는 `video_url` 사용) |
| `/v15.0/{IG-USER-ID}/scheduled_posts` | POST | `media_id`, `schedule_time`(ISO 8601 UTC), `status=ACTIVE` | 예약 게시 기능, `schedule_time`은 UTC 기준 |
| `/v15.0/{IG-USER-ID}/media_insights` | GET | `metric=engagement,impressions,reach,profile_views,video_views` | KPI 수집용 |

**예시 요청 (Python `requests`)**

```python
import requests, os, json

TOKEN = os.getenv('META_ACCESS_TOKEN')
BASE_URL = f"https://graph.facebook.com/v15.0"

def create_media(image_url, caption):
    payload = {
        "image_url": image_url,
        "caption": caption,
        "access_token": TOKEN
    }
    r = requests.post(f"{BASE_URL}/{IG_USER_ID}/media", data=payload)
    return r.json()["id"]  # media_id

def schedule_post(media_id, utc_time):
    payload = {
       
