# 💻 코다리 — Python으로 위 인스타그램 예약 스크립트를 작성하라. 인증 토큰과 엔드포인트는 환경변수에서 불러오며, 성공/실패 로그를 콘솔에 출력하고, 최종 스크립트 파일을 sessions/2026-11-16T???.py 경로에 저장한다.

💻 코다리: 작업 시작합니다.

```python
# sessions/2026-11-16T09_30_instagram_scheduler.py

"""
Instagram Graph API 자동 예약 스크립트
------------------------------------
* 환경 변수:
  - INSTAGRAM_ACCESS_TOKEN   : 사용자 액세스 토큰
  - INSTAGRAM_GRAPH_API_URL : 기본 엔드포인트 (예: https://graph.facebook.com/v18.0)
* 입력 파일:
  - schedule.json            : JSON 리스트, 각 항목에 type('post'|'reel'), media_path, caption, scheduled_time(KST ISO8601) 필수
* 기능:
  - 이미지/비디오 업로드 → Media Container 생성
  - 게시물 예약 (publish_time 설정)
  - 최대 3회 재시도(중간 2초 대기)
  - 성공/실패 로그 콘솔에 출력
"""

import os
import json
import time
from datetime import datetime, timezone, timedelta

import requests


ACCESS_TOKEN = os.getenv("INSTAGRAM_ACCESS_TOKEN")
BASE_URL = os.getenv("INSTAGRAM_GRAPH_API_URL", "https://graph.facebook.com/v18.0")

if not ACCESS_TOKEN:
    raise RuntimeError("INSTAGRAM_ACCESS_TOKEN 환경 변수가 설정되어 있지 않습니다.")


def upload_media(media_path: str, media_type: str) -> str:
    """
    Media Container 생성
    :param media_path: 로컬 파일 경로
    :param media_type: 'IMAGE' | 'VIDEO'
    :return: media_container_id
    """
    url = f"{BASE_URL}/me/media"
    files = {"image_file": open(media_path, "rb")} if media_type == "IMAGE" else {}
    data = {
        "media_type": media_type,
        "url": os.path.abspath(media_path),
        "access_token": ACCESS_TOKEN,
    }
    # For local file we use 'source' param
    if media_type == "VIDEO":
        files["video_file"] = open(media_path, "rb")
        data.pop("url", None)

    for attempt in range(3):
        try:
            resp = requests.post(url, data=data, files=files)
            resp.raise_for_status()
            return resp.json()["id"]
        except Exception as e:
            print(f"[업로드 실패] {media_path} ({attempt+1}/3): {e}")
            time.sleep(2)
    raise RuntimeError(f"Media upload failed after 3 attempts: {media_path}")


def publish_post(container_id: str, caption: str, scheduled_time: datetime):
    """
    게시물 예약
    :param container_id: 미디어 컨테이너 ID
    :param caption: 캡션 문자열
    :param scheduled_time: KST 시간 (UTC로 변환)
    """
    url = f"{BASE_URL}/me/media_publish"
    payload = {
        "creation_id": container_id,
        "caption": caption,
        "access_token": ACCESS_TOKEN,
        # publish_time is optional; if provided, schedules post
        "published": False,
        "scheduled_publish_time": int(scheduled_time.timestamp()),
    }

    for attempt in range(3):
        try:
            resp = requests.post(url, data=payload)
            resp.raise_for_status()
            result = resp.json()
            print(f"[성공] 게시물 ID: {result.get('id')}, 예약 시각: {scheduled_time.isoformat()}")
            return
        except Exception as e:
            print(f"[예약 실패] 컨테이너 {container_id} ({attempt+1}/3): {e}")
            time.sleep(2)
    raise RuntimeError(f"Failed to schedule post after 3 attempts for container {container_id}")


def main():
    # 스케줄 파일 로드
    with open("schedule.json", "r", encoding="utf-8") as f:
        schedule = json.load(f)

    for idx, item in enumerate(schedule, start=1):
        try:
            media_path = item["media_path"]
            caption = item.get("caption", "")
            # KST ISO8601 문자열 → datetime 객체
            kst_time = datetime.fromisoformat(item["scheduled_time"])
            # UTC 변환
            utc_time = kst_time.astimezone(timezone.utc)

            media_type = "VIDEO" if media_path.lower().endswith((".mp4", ".mov")) else "IMAGE"

            print(f"\n=== 게시물 {idx} 처리 시작 ===")
            container_id = upload_media(media_path, media_type)
            publish_post(container_id, caption, utc_time)
        except Exception as e:
            print(f"[오류] 게시물 {idx} 처리 중 예외 발생: {e}")


if __name__ == "__main__":
    main()
```

✅ 스크립트 저장 완료: `sessions/2026-11-16T09_30_instagram_scheduler.py`  
💡 이 파일은 환경 변수와 `schedule.json`에 정의된 항목을 기반으로 이미지/비디오 업로드 및 예약 게시를 수행합니다. 로그는 콘솔에 바로 출력됩니다.

📊 평가: 완료 — 스크립트가 요구 사항을 충족하고 실행 준비가 됨  
📝 다음 단계: `schedule.json` 예시 파일 생성 또는 실제 데이터를 입력해 테스트 실행 필요

