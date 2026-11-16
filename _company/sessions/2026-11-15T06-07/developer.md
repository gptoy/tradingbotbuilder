# 💻 코다리 — Python 스크립트 작성: (1) YOUTUBE_API_KEY와 YOUTUBE_CHANNEL_ID를 환경 변수에서 읽어오고, YouTube Data API v3를 호출해 현재 구독자 수, 총 조회수 및 최근 5개의 영상(제목, ID, 공개 일자)를 가져온다. (2) Slack Webhook URL을 이용해 JSON 포맷으로 메시지를 전송한다. (3) 크론탭 파일 예

💻 코다리: 작업 시작합니다.

## 1️⃣ Python 스크립트 (youtube_stats.py)

```python
# 📍 c:/Users/user/MelatoninApp/youtube_stats.py

import os
import json
import logging
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)

load_dotenv()  # .env 파일이 있을 경우 로드

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
CHANNEL_ID = os.getenv("YOUTUBE_CHANNEL_ID")
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL")

if not all([YOUTUBE_API_KEY, CHANNEL_ID, SLACK_WEBHOOK_URL]):
    logging.error("필수 환경 변수가 설정되지 않았습니다.")
    exit(1)

YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"

def fetch_channel_stats(channel_id: str) -> dict:
    """채널 메타데이터 (구독자, 조회수) 가져오기"""
    url = f"{YOUTUBE_API_BASE}/channels"
    params = {
        "part": "statistics",
        "id": channel_id,
        "key": YOUTUBE_API_KEY,
    }
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    data = resp.json()["items"][0]["statistics"]
    return {
        "subscriberCount": int(data["subscriberCount"]),
        "viewCount": int(data["viewCount"]),
    }

def fetch_recent_videos(channel_id: str, max_results: int = 5) -> list[dict]:
    """최근 공개된 동영상 목록 (제목, ID, 게시일) 가져오기"""
    url = f"{YOUTUBE_API_BASE}/search"
    params = {
        "part": "snippet",
        "channelId": channel_id,
        "order": "date",
        "maxResults": max_results,
        "type": "video",
        "key": YOUTUBE_API_KEY,
    }
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    items = resp.json()["items"]
    videos = []
    for item in items:
        snippet = item["snippet"]
        videos.append(
            {
                "title": snippet["title"],
                "videoId": item["id"]["videoId"],
                "publishedAt": snippet["publishedAt"],
            }
        )
    return videos

def build_slack_payload(stats: dict, videos: list[dict]) -> dict:
    """Slack에 전송할 JSON 메시지 구성"""
    now = datetime.now(timezone.utc).isoformat()
    attachment_text = "\n".join(
        f"- <https://youtu.be/{v['videoId']}|{v['title']}> ({v['publishedAt'][:10]})"
        for v in videos
    )
    payload = {
        "username": "YouTube Stats Bot",
        "icon_emoji": ":youtube:",
        "attachments": [
            {
                "fallback": f"YouTube stats as of {now}",
                "color": "#FF0000",
                "pretext": f"📺 YouTube Channel Stats ({now})",
                "fields": [
                    {"title": "구독자 수", "value": f"{stats['subscriberCount']:,}", "short": True},
                    {"title": "총 조회수", "value": f"{stats['viewCount']:,}", "short": True},
                ],
                "text": attachment_text,
            }
        ],
    }
    return payload

def send_to_slack(payload: dict) -> None:
    """Webhook URL로 Slack에 메시지 전송"""
    resp = requests.post(SLACK_WEBHOOK_URL, json=payload)
    resp.raise_for_status()
    logging.info("Slack에 메시지를 보냈습니다.")

def main() -> None:
    stats = fetch_channel_stats(CHANNEL_ID)
    videos = fetch_recent_videos(CHANNEL_ID)
    payload = build_slack_payload(stats, videos)
    send_to_slack(payload)

if __name__ == "__main__":
    main()
```

### 주요 포인트
- `.env` 파일에서 환경 변수를 로드 → **안전**  
- `requests`로 API 호출 → 에러 처리 포함  
- Slack payload는 `attachments`를 사용해 가독성 높게 구성  
- 구독자·조회수는 천단위 콤마 표시  

## 2️⃣ 크론탭 예시

```cron
# /etc/cron.d/youtube_stats
0 9 * * *   root   cd "/c/Users/user/MelatoninApp" && /usr/bin/python3 youtube_stats.py >> youtube_stats.log 2>&1
```

- 매일 오전 9시에 실행  
- 로그를 `youtube_stats.log`에 저장  

---

📊 평가: 완료 — 스크립트와 크론 예시가 완성되었습니다.  
📝 다음 단계: `.env.example` 파일을 업데이트해 필요한 키/URL 안내.
