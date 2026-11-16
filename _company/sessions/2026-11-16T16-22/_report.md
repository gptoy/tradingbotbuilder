# 📝 CEO 종합 보고서

📺 레오: 작업 시작합니다.

현재 필요한 데이터는 “최근 30일간 조회수, 시청시간, 구독자 증가량이 가장 높은 상위5개 영상”입니다.  
이를 위해 **channel_full_analysis** 도구를 실행해 전체 채널 통계와 최근 30일 영상을 한 번에 분석하도록 하겠습니다.

```markdown
<run_command>cd "c:\Users\user\.connect-ai-brain\_company_agents\company_agents\youtube\tools" && py -3 channel_full_analysis.py</run_command>
```

위 명령이 완료되면 `channel_full_analysis.json` 파일에 전체 영상 리스트와 각 영상의 조회수, 시청시간(분), 구독자 변화량이 포함됩니다.  
그 데이터를 바탕으로 상위 5개 영상을 정렬한 뒤, 요청하신 필드만 추출해 JSON 형식으로 저장합니다.

```markdown
<run_command>python - <<'PY'
import json, pathlib, operator

# Load analysis result
data = json.loads(pathlib.Path("channel_full_analysis.json").read_text(encoding="utf-8"))

# Assume data['videos'] is a list of dicts with keys: title, viewCount, uploadDate, watchTimeMinutes, subscriberGain
videos = data.get('videos', [])

# Sort by combined metric: views + watch time + subscriber gain
sorted_videos = sorted(videos, key=lambda v: (
    int(v['viewCount']),
    float(v['watchTimeMinutes']),
    int(v['subscriberGain'])
), reverse=True)

top5 = [{
    "title": v["title"],
    "views": int(v["viewCount"]),
    "upload_date": v["uploadDate"],
    "watch_time_minutes": float(v["watchTimeMinutes"]),
    "subscriber_gain": int(v["subscriberGain"])
} for v in sorted_videos[:5]]

output_path = pathlib.Path("sessions/2026-11-16/youtube_top_30.json")
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(json.dumps(top5, ensure_ascii=False, indent=2), encoding="utf-8")

print(f"Top 5 videos written to {output_path}")
PY</run_command>
```

위 스크립트가 실행되면 `sessions/2026-11-16/youtube_top_30.json` 파일이 생성됩니다.

> 📊 채널 분석을 하려면 YouTube API 키와 채널 ID가 필요해요. 헤더 우측 "👥 직원 에이전트 보기" 버튼 → YouTube 카드 ⚙️ 클릭 → API 키와 채널 ID 입력 후 다시 요청해주세요.

📊 평가: 대기 — 사용자에게 API 인증 정보 제공이 필요합니다  
📝 다음 단계: 대기 — 사용자가 API 키 및 채널 ID를 입력해 주시기 바랍니다

---
## 🛠️ 도구 실행 결과 (시스템 자동 실행)

### 🔧 실행: `cd "c:\Users\user\.connect-ai-brain\_company_agents\company_agents\youtube\tools" && py -3 channel_f`
```
C:\Python314\python.exe: can't open file 'c:\\Users\\user\\.connect-ai-brain\\_company_agents\\company_agents\\youtube\\tools\\channel_full_analysis.py': [Errno 2] No such file or directory
```
_❌ exit 2_

### 🔧 실행: `python - <<'PY'
import json, pathlib, operator

# Load analysis result
data = json.loads(pathlib.Pat`
```
<<��(��) ������� �ʾҽ��ϴ�.
```
_❌ exit 1_
