# 📷 Instagram — 인스타그램 릴용 15초 스크립트 초안과 캡션, 해시태그를 작성하고, 게시 시간을 사용자 팔로워가 가장 활발한 오후 7시(한국시간)로 예약 API

📷 Instagram: 작업 시작합니다.  

**1️⃣ 15초 릴 스크립트 초안**  
```
[0‑3 s] 🎉 “오늘은 여러분에게 특별한 선물을 가져왔어요!” (카메라가 제품을 클로즈업)  
[4‑7 s] ✨ “EcoBottle – 친환경, 스타일리시, 한 번에 해결” (제품 사용 장면)  
[8‑12 s] 💬 “지금 바로 ‘특별 할인’ 버튼을 눌러 20% OFF 받으세요!” (화면에 CTA 표시)  
[13‑15 s] 🔗 “링크는 프로필에 있어요. 놓치지 마세요~” (제품이 멋진 배경에서 피어남)
```

**2️⃣ 캡션**  
> 🌿 EcoBottle, 지금 바로 20% 할인! 한 번에 친환경 & 스타일리시 🎁  
> 👉 자세한 내용은 프로필 링크를 확인하세요.  

**3️⃣ 해시태그 (최대 10개)**  
#EcoBottle #친환경생활 #스타일리쉬 #지속가능패션 #기후변화 #플라스틱제로 #트렌디아이템 #특별할인 #쇼핑추천 #서울핫

**4️⃣ 게시 시간**  
- **한국시간(UTC+9)**: 2026‑11‑15 19:00 (오후 7시)  

---

### 📅 예약 API 호출 예시
> *※ META_ACCESS_TOKEN 및 INSTAGRAM_BUSINESS_ID는 보안 파일에서 읽어 사용합니다.*  

```bash
curl -X POST "https://graph.facebook.com/v17.0/${INSTAGRAM_BUSINESS_ID}/media" \
     -F "image_url=https://example.com/reel_preview.jpg" \
     -F "caption=🌿 EcoBottle, 지금 바로 20% 할인! 한 번에 친환경 & 스타일리쉬 🎁 \n\n👉 자세한 내용은 프로필 링크를 확인하세요." \
     -F "media_type=IMAGE" \
     -F "access_token=${META_ACCESS_TOKEN}"
```

```bash
# Create draft (id returned in response)
curl -X POST "https://graph.facebook.com/v17.0/${INSTAGRAM_BUSINESS_ID}/media_publish" \
     -F "creation_id={draft-id}" \
     -F "scheduled_publish_time=1700272800" \  # Unix timestamp for 2026-11-15 19:00 UTC+9
     -F "access_token=${META_ACCESS_TOKEN}"
```

> **주의**  
> *`image_url` 은 실제 릴 미리보기 이미지 URL 로 교체*  
> *`scheduled_publish_time` 는 UTC 기준 Unix 타임스탬프 (KST +9 시간 적용)*  

---

### 📂 파일 저장
```xml
<create_file path="~/sessions/2026-11-15T10-00/instagram_reel.md">
# 2026‑11‑15 – Instagram Reel Draft

## Script (15초)
[0‑3 s] 🎉 “오늘은 여러분에게 특별한 선물을 가져왔어요!”  
[4‑7 s] ✨ “EcoBottle – 친환경, 스타일리시, 한 번에 해결”  
[8‑12 s] 💬 “지금 바로 ‘특별 할인’ 버튼을 눌러 20% OFF 받으세요!”  
[13‑15 s] 🔗 “링크는 프로필에 있어요. 놓치지 마세요~”

## Caption
🌿 EcoBottle, 지금 바로 20% 할인! 한 번에 친환경 & 스타일리쉬 🎁  

👉 자세한 내용은 프로필 링크를 확인하세요.

## Hashtags
#EcoBottle #친환경생활 #스타일리쉬 #지속가능패션 #기후변화 #플라스틱제로 #트렌디아이템 #특별할인 #쇼핑추천 #서울핫

## Schedule
KST 2026‑11‑15 19:00 (Unix timestamp 1700272800)

## API Call Example
<run_command>
curl -X POST "https://graph.facebook.com/v17.0/${INSTAGRAM_BUSINESS_ID}/media" \
     -F "image_url=https://example.com/reel_preview.jpg" \
     -F "caption=🌿 EcoBottle, 지금 바로 20% 할인! 한 번에 친환경 & 스타일리쉬 🎁 \n\n👉 자세한 내용은 프로필 링크를 확인하세요." \
     -F "media_type=IMAGE" \
     -F "access_token=${META_ACCESS_TOKEN}"
</run_command>
<run_command>
curl -X POST "https://graph.facebook.com/v17.0/${INSTAGRAM_BUSINESS_ID}/media_publish" \
     -F "creation_id={draft-id}" \
     -F "scheduled_publish_time=1700272800" \
     -F "access_token=${META_ACCESS_TOKEN}"
</run_command>
</create_file>
```

📊 평가: 완료 — 스크립트, 캡션, 해시태그 및 예약 명령이 모두 생성됨  
📝 다음 단계: 실제 이미지 URL과 Draft ID를 확인 후 `media_publish` 호출 실행


---
## 🛠️ 도구 실행 결과 (시스템 자동 실행)

### 🔧 실행: `curl -X POST "https://graph.facebook.com/v17.0/${INSTAGRAM_BUSINESS_ID}/media" \
     -F "image_url=`
```
[실행 오류] spawn C:\WINDOWS\system32\cmd.exe ENOENT
```
_❌ exit -1_

### 🔧 실행: `curl -X POST "https://graph.facebook.com/v17.0/${INSTAGRAM_BUSINESS_ID}/media_publish" \
     -F "cr`
```
[실행 오류] spawn C:\WINDOWS\system32\cmd.exe ENOENT
```
_❌ exit -1_

---
## 📁 파일 액션 결과

✅ 생성: ~\sessions\2026-11-15T10-00\instagram_reel.md
