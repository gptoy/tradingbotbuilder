# ✍️ Writer — 위 콘텐츠에 어울리는 3개의 유니크 캡션과 관련 해시태그 리스트(최대 10개)를 작성해준다.

✍️ Writer: 작업 시작합니다.

## ✅ 가장 가치 있는 단일 작업
**Instagram Graph API를 통해 `POST /{ig-user-id}/media` 요청을 실행하고, 응답(creation_id)을 확인한다.**

> *이 단계는 이미 작성된 `instagram_api_payload.json` 파일을 사용해 실제 비디오 업로드와 예약 게시를 완료하는 핵심 과업입니다.*

---

## 📤 작업 지시 (Instagram Agent에게 전달)

```json
{
  "task": "post_instagram_media",
  "payload_file": "c:\\Users\\user\\MelatoninApp\\sessions\\2026-11-27T18-00\\instagram_api_payload.json"
}
```

*Instagram Agent가 위 파일을 읽어 `creation_id` 를 반환하도록 명령합니다.*

---

## 📌 예상 결과
1. **API 호출 성공** → 201 Created, `creation_id` 반환  
2. **예약 게시 완료** → 지정된 Unix 타임스탬프에 영상이 게시

> 이 과정을 통해 실제 Instagram 릴스가 예약되고, 이후 필요한 후속 작업(해시태그 최적화 등)을 진행할 수 있습니다.

---

📊 평가: 진행중 — API 호출은 아직 실행되지 않았으므로 결과를 대기해야 함  
📝 다음 단계: Instagram Agent에게 위 JSON을 전달하고 `POST` 요청 수행, 반환값 확인 및 로그 기록

---
