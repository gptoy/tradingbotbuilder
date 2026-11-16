# 📷 Instagram — 2026년 12월 주간 인스타그램 릴스·피드 게시물 JSON 스케줄을 읽어 각 항목을 KST 기준으로 예약하도록 Instagram Graph API 호출 로직을 구현하고, 실패 시 최대 3회 재시도하도록 명세합니다.

📷 Instagram: 작업 시작합니다.  
다음은 **2026년 12월 주간 인스타그램 릴스·피드 게시물 스케줄**(JSON)을 읽어 KST 기준으로 예약하고, 실패 시 최대 3회 재시도하도록 설계한 Python 스크립트입니다.  

```python
<create_file path="sessions/2026-12-01_schedule_runner.py">
import json
import os
import datetime
import time
import requests

# ─────────────────────── 상수 정의 ───────────────────────
SCHEDULE_PATH = "sessions/2026-11-16T09-52/instagram.md"   # JSON 스케줄이 저장된 파일
META_ACCESS_TOKEN = os.getenv("META_ACCESS_TOKEN")           # .env 혹은 시스템 변수에서 읽음
INSTAGRAM_BUSINESS_ID = os.getenv("INSTAGRAM_BUSINESS_ID")
API_URL_TEMPLATE = (
    "https://graph.facebook.com/v17.0/{business_id}/media"
)  # Graph API 엔드포인트

# ─────────────────────── 헬퍼 함수 ───────────────────────
def kst_now() -> datetime.datetime:
    """현재 KST 시간을 반환"""
    return datetime.datetime.utcnow() + datetime.timedelta(hours=9)

def load_schedule(path: str) -> list[dict]:
    """JSON 스케줄 파일을 파싱해서 리스트 반환"""
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data["posts"]

def post_to_instagram(post: dict) -> bool:
    """
    Instagram Graph API 를 통해 미디어 객체를 예약 게시
    성공 시 True, 실패 시 False 반환
    """
    url = API_URL_TEMPLATE.format(business_id=INSTAGRAM_BUSINESS_ID)
    payload = {
        "image_url": post["media_url"],
        "caption": post["caption"],
        "scheduled_publish_time": int(post["schedule_ts"]),  # Unix epoch (KST)
        "access_token": META_ACCESS_TOKEN,
    }
    # 릴스는 media_type=REEL, 피드는 IMAGE
    payload["media_type"] = "VIDEO" if post.get("is_reel") else "IMAGE"

    try:
        resp = requests.post(url, data=payload, timeout=10)
        resp.raise_for_status()
        return True
    except Exception as e:
        print(f"[ERROR] {post['title']}: {e}")
        return False

def schedule_posts(schedule: list[dict]):
    """스케줄에 따라 게시물 예약. 실패 시 최대 3회 재시도"""
    for post in schedule:
        attempts = 0
        success = False
        while attempts < 3 and not success:
            print(f"[INFO] {kst_now().isoformat()} - '{post['title']}' (Attempt {attempts+1})")
            success = post_to_instagram(post)
            if not success:
                attempts += 1
                time.sleep(5)  # 5초 대기 후 재시도
        if not success:
            print(f"[WARN] '{post['title']}' 예약 실패 (최대 시도 횟수 초과)")

def main():
    posts = load_schedule(SCHEDULE_PATH)
    schedule_posts(posts)

if __name__ == "__main__":
    main()
</create_file>
```

### 사용법
1. **환경 변수 설정**  
   ```bash
   export META_ACCESS_TOKEN="YOUR_META_TOKEN"
   export INSTAGRAM_BUSINESS_ID="YOUR_BUSINESS_ID"
   ```
2. **스크립트 실행**  
   ```bash
   python sessions/2026-12-01_schedule_runner.py
   ```

> 스케줄 파일(`sessions/2026-11-16T09-52/instagram.md`)은 앞서 생성한 JSON 형태의 `posts` 배열을 포함하고 있어야 합니다. 각 항목에는  
> - `title`: 게시물 제목  
> - `media_url`: 이미지/비디오 URL  
> - `caption`: 캡션 (해시태그 포함)  
> - `schedule_ts`: KST 기준 Unix epoch 시각  
> - `is_reel`: 릴스 여부 (`True`이면 VIDEO, `False`이면 IMAGE)

### 로깅 및 오류 처리
- 각 요청마다 현재 KST 시간을 로그에 기록합니다.  
- 실패 시 5초 대기 후 최대 3회 재시도합니다.  
- 최종 실패 시 경고 메시지를 출력합니다.

📊 평가: 진행중 — 스케줄 파일이 정확히 JSON 포맷인지 확인 필요  
📝 다음 단계: `sessions/2026-11-16T09-52/instagram.md`의 실제 구조를 검토하고, 필요하면 스크립트에 맞춰 변형합니다

---
## 📁 파일 액션 결과

✅ 생성: c:\Users\user\REA\sessions\2026-12-01_schedule_runner.py
