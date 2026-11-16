# 🎨 Designer — 가격 테이블과 브랜드 일관성을 고려한 슬라이드와 썸네일 디자인을 제작해 주세요.

🎨 Designer: 작업 시작합니다.

## 디자인 브리프 – 가격 테이블 & 브랜드 일관성

아래 파일은 **슬라이드**(1920x1080)와 **썸네일**(1280x720) 디자인 사양을 정리한 문서입니다.  
브랜드 톤과 색상, 타이포그래피를 명확히 정의해 다른 팀원들이 그대로 활용할 수 있도록 합니다.

```markdown
# 2026-11-13 가격 테이블 및 브랜드 일관성 디자인 브리프

## 1️⃣ 핵심 요소
| 항목 | 값 |
|------|----|
| **브랜드 컬러** | #FF0000 (레드) <br> #000000 (블랙) <br> #FFFFFF (화이트) |
| **타이포그래피** | **Primary**: Montserrat Bold, 48pt (헤더) <br> **Secondary**: Open Sans Regular, 18pt (본문) |
| **배경** | 화이트(#FFFFFF) 기본. 필요 시 그라데이션(레드→블랙) 활용 가능 |
| **아이콘** | Feather Icons, 색상 #FF0000 또는 #FFFFFF |
| **구조** | 그리드: 12컬럼 (슬라이드: 1200px 기준, 썸네일: 640px 기준) |

## 2️⃣ 슬라이드 레이아웃 (1920×1080)
- **헤더 영역**  
  - 위치: 상단 120px 높이, 중앙 정렬  
  - 텍스트: `가격 비교` (Montserrat Bold, 48pt, #FF0000)  
  - 배경: 투명 또는 얇은 레드 그라데이션

- **가격 테이블**  
  | 컬럼 | 내용 | 스타일 |
  |------|------|--------|
  | Product | $500 (정규), $29 (할인) | Montserrat Bold, 36pt, #000000 |
  | Feature | 상세 항목 리스트 | Open Sans Regular, 18pt, #333333 |
  | Price | $500 vs $29 | Montserrat Bold, 48pt, #FF0000 for $29, #000000 for $500 |
  
  - **테이블 배경**: 화이트 박스에 둥근 모서리(8px), 그림자(0 px 4 px 10 px rgba(0,0,0,.1))  
  - **$29 강조**: 배경 색상 #FF0000, 텍스트 흰색

- **버튼/CTA**  
  - 위치: 테이블 아래 중앙, 상단 여백 60px  
  - 텍스트: `지금 구매` (Montserrat Bold, 24pt, #FFFFFF)  
  - 배경: #FF0000, 둥근 모서리(6px), hover 시 약간 밝아짐

- **로고 및 기타**  
  - 좌상단에 브랜드 로고 삽입 (#FF0000 로고, 투명 배경)  
  - 우하단에는 소셜 아이콘 (Feather Icons, #FF0000)

## 3️⃣ 썸네일 레이아웃 (1280×720)
- **배경**: 반투명 레드 그라데이션(오른쪽 하단에서 왼쪽 위)  
- **메인 텍스트**: `$29에 바로 시작하세요!` (Montserrat Bold, 48pt, #FFFFFF)  
- **부가 텍스트**: `한정 72시간 세일` (Open Sans Regular, 24pt, #FF0000)  
- **가격 강조**: `$29` 부분을 크게 표시(60pt), 배경은 #FF0000 블록에 흰색 글자  
- **버튼**: 중앙 하단 `구매하기` 버튼 (#FFFFFF 텍스트, #FF0000 배경)  

## 4️⃣ 파일 구조
```
/design/
├─ assets/
│   ├─ fonts/
│   │   ├─ Montserrat-Bold.ttf
│   │   └─ OpenSans-Regular.ttf
│   └─ icons/
│       └─ feather-icons.svg
├─ slides/
│   └─ price_comparison_slide.psd
└─ thumbnails/
    └─ price_thumbnails.png
```

> **주의**  
> - 모든 색상은 HEX 코드로 지정했으며, 필요 시 RGB/CMYK 변환을 포함해 인쇄용 파일을 준비하세요.  
> - 텍스트와 요소들은 12px 단위의 그리드에 맞추어 배치하도록 하세요.

## 5️⃣ 참고 리소스
- [Figma 파일 링크](/design/figma) – 실제 디자인 구현 예시  
- [Brand Style Guide](/design/style_guide.pdf)

---

**완성 기준:** 슬라이드 PSD와 썸네일 PNG가 `sessions/2026-11-13/`에 저장되었고, 위 사양을 모두 충족해야 합니다.

```

```

```commentary<|message|>We need to create file.
