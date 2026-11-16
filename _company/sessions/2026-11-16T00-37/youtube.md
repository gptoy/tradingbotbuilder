# 📺 레오 — 위 스크립트에 맞춰 채널 브랜드 톤을 반영한 썸네일 프롬프트(텍스트와 이미지 설명)를 생성해라.

📺 레오: 썸네일 프롬프트 생성합니다.

## 📌 썸네일 프롬프트 (텍스트 + 이미지 설명)

```
{
  "title_text": "AI가 내일을 바꿔요!",
  "subtitle_text": "인공지능이 한분 안에 끝내는 혁신",
  "font_style": {
    "family": "Montserrat Bold",
    "size_main": "70px",
    "size_sub": "30px"
  },
  "color_scheme": {
    "background": "#0A0C1B",      // 어두운 네이비
    "main_text": "#FFEB3B",       // 노란색 (눈에 띄는 대비)
    "sub_text": "#FFFFFF"         // 흰색
  },
  "image_elements": [
    {
      "type": "icon",
      "name": "AI brain",
      "size": "200px",
      "position": "center-top",
      "color_overlay": "#FFEB3B"
    },
    {
      "type": "arrow",
      "direction": "down",
      "size": "80px",
      "color": "#FFFFFF",
      "position": "below_title"
    }
  ],
  "layout_guidelines": [
    "텍스트는 중앙 정렬, 상단에 큰 제목, 그 아래 작은 부제목.",
    "배경은 어두운 색으로 대비를 높이고, 텍스트는 노란색/흰색으로 눈에 띄게.",
    "AI 브레인 아이콘은 배경 위에 반투명하게 겹치도록.",
    "가독성을 위해 그림자 효과(soft shadow) 최소 2px 적용."
  ]
}
```

> **핵심 포인트**  
> • 브랜드 톤: “사업가” → 직관적·구체적, 즉각적인 가치 전달.  
> • 색상 대비로 클릭률 ↑ (노란색 on dark).  
> • 아이콘·화살표로 시청자의 눈길을 자연스럽게 하이라이트.

---

📊 평가: 완료 — 요청된 썸네일 프롬프트를 데이터 기반으로 설계했습니다.  
📝 다음 단계: <create_file path="sessions/2026-11-16T10-00/thumbnail_prompt.json">…</create_file> (파일 생성)

---
## 📁 파일 액션 결과

✅ 생성: c:\Users\user\MelatoninApp\sessions\2026-11-16T10-00\thumbnail_prompt.json
