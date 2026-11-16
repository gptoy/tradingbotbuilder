# 📝 CEO 종합 보고서

💻 코다리: 작업 시작합니다.

## 1️⃣ 결정한 단일 작업
YouTube Data API 를 활용해 지정 폴더(`videos/`)에서 비디오 파일과 대응되는 메타데이터(제목·설명·태그)를 읽어들여 **비디오를 업로드**하도록 파이썬 스크립트를 작성한다.  
- 기존에 `sessions/2026-11-13T23-20/developer.md` 에서 비슷한 아이디어가 있었지만, 아직 실제 코드와 테스트는 없으므로 이 작업이 가장 가치 있다.

## 2️⃣ 담당자 할당
**개발자(Developer) 에이전트**에게 파일 생성·배포를 맡긴다.  
- `sessions/2026-11-14T00-20/developer.md` 로 결과물을 기록한다.

## 3️⃣ 실행 계획

1. **폴더 구조 파악**  
   ```bash
   videos/
     video1.mp4
     video1.json  # {"title":"...", "description":"...", "tags":["..."]} 형태
     ...
   ```
2. **스크립트 설계**  
   - `config.py`에 API 키와 채널 ID 저장(환경 변수 사용).  
   - `upload_video.py`에서 `google-api-python-client` 활용.  
   - 파일 읽기, 메타데이터 파싱 → API 호출 → 업로드 진행.  
3. **테스트**  
   - 로컬에서 하나의 동영상만 실행해 테스트 후 로그 확인.  
4. **크론 스케줄러 설정**  
   - `cron`(리눅스) 혹은 `schtasks` 윈도우로 매일 자정 실행.

## 4️⃣ 코드 작성

### <create_file path="~/dev/youtube_uploader/config.py">
```python
import os
from pathlib import Path

# 환경 변수에서 API 키와 채널 ID 가져오기
API_KEY = os.getenv("YOUTUBE_API_KEY")
CHANNEL_ID = os.getenv("YOUTUBE_CHANNEL_ID")

if not API_KEY or not CHANNEL_ID:
    raise RuntimeError("환경 변수가 설정되지 않았습니다: YOUTUBE_API_KEY, YOUTUBE_CHANNEL_ID")

# 업로드할 폴더 경로
VIDEO_DIR = Path.home() / "dev" / "youtube_uploader" / "videos"
```
</create_file>

### <create_file path="~/dev/youtube_uploader/upload_video.py">
```python
import os
from pathlib import Path
import json
import logging
import sys

from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# 로깅 설정
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")

try:
    from config import API_KEY, CHANNEL_ID, VIDEO_DIR
except ImportError as e:
    logging.error("config 모듈 불러오기 실패: %s", e)
    sys.exit(1)

def upload_video(file_path: Path, metadata: dict):
    """YouTube에 동영상 업로드"""
    youtube = build("youtube", "v3", developerKey=API_KEY)

    request_body = {
        "snippet":

---
## 📁 파일 액션 결과

✅ 생성: ~\dev\youtube_uploader\config.py
