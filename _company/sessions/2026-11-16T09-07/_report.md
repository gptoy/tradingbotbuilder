# 📝 CEO 종합 보고서

💻 코다리: 스크립트 작성 시작합니다.

```python
# 📁 sessions/2026-11-27_instagram_scheduler.py
"""
Instagram Graph API를 이용해 릴스(비디오)와 피드 포스트(이미지)를 예약 게시하는 스크립트.
요구사항:
  • OAuth 액세스 토큰 로드 (env 또는 config 파일)
  • 이미지/비디오 업로드 → creation_id 획득
  • caption + 해시태그 포함
  • media_publish 호출로 실제 게시
  • 예약시간에 맞춰 실행 (APScheduler 사용)
  • 오류 시 재시도(3회) + exponential backoff
  • 로깅 및 예외 캡처
"""

import os
import json
import time
from datetime import datetime, timedelta

import requests
from apscheduler.schedulers.blocking import BlockingScheduler
from tenacity import retry, stop_after_attempt, wait_exponential_jitter, retry_if_exception_type

# ----------------- 설정 로드 -----------------
CONFIG_PATH = os.getenv("INSTAGRAM_CONFIG", "instagram_config.json")
with open(CONFIG_PATH) as f:
    cfg = json.load(f)

IG_USER_ID = cfg["ig_user_id"]
ACCESS_TOKEN = cfg["access_token"]  # OAuth 토큰, 90일 이후 갱신 필요

BASE_URL = "https://graph.facebook.com/v17.0"

# ----------------- 유틸리티 -----------------
def log(msg: str):
    print(f"[{datetime.now().isoformat()}] {msg}")

@retry(
    reraise=True,
    stop=stop_after_attempt(3),
    wait=wait_exponential_jitter(min=1, max=10),
    retry=retry_if_exception_type(requests.RequestException),
)
def api_call(method: str, endpoint: str, params=None, data=None, files=None):
    url = f"{BASE_URL}/{endpoint}"
    if method.upper() == "POST":
        resp = requests.post(url, params=params, data=data, files=files, timeout=30)
    else:
        resp = requests.get(url, params=params, timeout=30)

    if not resp.ok:
        log(f"API Error {resp.status_code}: {resp.text}")
        resp.raise_for_status()
    return resp.json()

def upload_media(media_path: str, caption: str, media_type: str) -> str:
    """
    1. POST /{ig_user_id}/media (creation_id 반환)
    2. POST /{ig_user_id}/media_publish (게시)
    """
    log(f"Uploading {media_type} '{media_path}'")
    files = {"file": open(media_path, "rb")}
    params = {
        "access_token": ACCESS_TOKEN,
        "image_url": media_path if media_type == "IMAGE" else None,
        "video_url": media_path if media_type == "VIDEO" else None,
        "caption": caption,
        "media_type": media_type,
    }
    # ① media 생성
    creation = api_call(
        "POST",
        f"{IG_USER_ID}/media",
        params=params,
        files=files if media_type == "IMAGE" else None,  # video uploads need file param
    )
    creation_id = creation["id"]
    log(f"Created media {creation_id}")

    # ② 실제 게시
    publish_params = {"access_token": ACCESS_TOKEN, "creation_id": creation_id}
    pub_resp = api_call("POST", f"{IG_USER_ID}/media_publish", params=publish_params)
    post_id = pub_resp["id"]
    log(f"Published media {post_id}")
    return post_id

# ----------------- 스케줄러 로직 -----------------
def schedule_post(item: dict):
    """
    item 예시:
      {
        "type": "VIDEO",
        "path": "/tmp/vid.mp4",
        "caption": "Check this out! #fun",
        "publish_at": "2026-11-30T12:00:00+09:00"
      }
    """
    publish_dt = datetime.fromisoformat(item["publish_at"])
    delay = (publish_dt - datetime.now()).total_seconds()
    if delay <= 0:
        log(f"Publish time {publish_dt} already passed, posting now.")
        upload_media(item["path"], item["caption"], item["type"])
        return

    def job():
        try:
            upload_media(item["path"], item["caption"], item["type"])
        except Exception as e:
            log(f"Failed to post scheduled media: {e}")

    scheduler.add_job(job, "date", run_date=publish_dt)
    log(f"Scheduled {item['type']} for {publish_dt.isoformat()}")

# ----------------- 메인 실행 -----------------
if __name__ == "__main__":
    # 예시 스케줄 데이터 (실제는 DB/파일에서 로드 가능)
    posts = [
        {
            "type": "IMAGE",
            "path": "./sample_photo.jpg",
            "caption": "Beautiful sunrise 🌅 #morning #nature",
            "publish_at": (datetime.now() + timedelta(minutes=1)).isoformat(),
        },
        {
            "type": "VIDEO",
            "path": "./sample_clip.mp4",
            "caption": "Catch the hype! 🎬 #shorts #viral",
            "publish_at": (datetime.now() + timedelta(minutes=2)).isoformat(),
        },
    ]

    scheduler = BlockingScheduler()
    for p in posts:
        schedule_post(p)

    try:
        log("Starting scheduler...")
        scheduler.start()
    except KeyboardInterrupt:
        log("Stopping scheduler.")
```

**설명 & 사용법**

1. `instagram_config.json` 파일을 프로젝트 루트에 두고 다음 내용 넣기  
   ```json
   {
     "ig_user_id": "<YOUR_INSTAGRAM_BUSINESS_ID>",
     "access_token": "<YOUR_OAUTH_ACCESS_TOKEN>"
   }
   ```
2. 필요한 패키지 설치:  
   ```bash
   pip install requests apscheduler tenacity
   ```
3. 스크립트 실행:  
   ```bash
   python sessions/2026-11-27_instagram_scheduler.py
   ```

이 스크립트는 인증 토큰을 로드하고, 지정된 이미지/비디오를 업로드한 뒤, `publish_at` 시점에 실제 게시합니다. 재시도 로직은 Tenacity로 구현돼 네트워크 오류 시 3회까지 재시도하며 지터가 포함됩니다. 로깅을 통해 진행 상황과 에러를 추적할 수 있습니다.

📊 평가: 완료 — 스크립트가 요구 기능 전부를 구현하고, 재시도 및 예약 기능이 포함되어 있음  
📝 다음 단계: 실제 메타데이터와 토큰을 적용해 테스트 실행 및 로그 확인 필요.
