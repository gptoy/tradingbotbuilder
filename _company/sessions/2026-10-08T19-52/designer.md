# 🎨 Designer — 작성된 스크립트의 초반 2초 후킹(글리치 효과)과 '마감 임박' 타이머 오버레이, 빨간색 경고등 효과가 포함된 프로모션용 썸네일 및 영상 오버레이 최종 디자인 브리프를 작성하세요.

🎨 Designer: 작업 시작합니다.

작성된 광고 스크립트의 심리적 트리거(Decoy Pricing, Urgency)를 시각적으로 완성하기 위한 **[프로모션 비주얼 시스템 및 썸네일 디자인 브리프]**입니다. 이 브리프는 편집자가 즉시 효과를 적용하고 에셋을 제작할 수 있도록 구체적인 수치와 스타일 가이드를 포함합니다.

---

# 🚨 [Design Brief] Survival Strategy Campaign Visual System

## 1. 핵심 디자인 컨셉 (Core Concept)
**"Visual Emergency & High Tension"**
- **심리적 목표:** '손실 회피(Loss Aversion)' 자극 및 '위기감' 조성.
- **시각적 문법:** 어두운 배경(Black/Dark Grey) + 강렬한 경고색(Red) + 디지털 오류(Glitch).
- **톤앤매너:** 정돈된 디자인이 아닌, 방금 터진 듯한 긴급하고 거친(Gritty) 느낌.

## 2. 비주얼 아이덴티티 가이드 (Visual Identity)

### 🎨 Color Palette
| 용도 | Hex Code | 설명 |
| :--- | :--- | :--- |
| **Primary Alert** | `#FF0000` | 경고등, 글리치 효과, 핵심 강조 텍스트 (Pure Red) |
| **Background** | `#000000` | 깊이감 있는 블랙 (심리적 압박 및 대비 극대화) |
| **Secondary Text** | `#FFFFFF` | 가독성을 위한 화이트 (핵심 정보 전달) |
| **Decoy Strike** | `#757575` | $500 등 지워져야 할 가격에 적용하는 그레이 |

### 🔡 Typography
- **Font Family:** `Pretendard` (Extra Bold / Black) 또는 `Impact`.
- **Style:** 자간(Letter Spacing)을 좁게 설정하여 밀도감과 압박감을 부여.
- **Effect:** 중요 문구에는 'Drop Shadow' 대신 'Outer Glow (Red)'를 사용하여 빛이 번지는 효과 적용.

---

## 3. 썸네일 컨셉 3안 (Thumbnail Concepts)

### [Option A] The Price Shock (가격 대비 강조형)
*   **구성:** 화면 좌측에 `$500` (그레이 컬러 + 큰 `X` 표시), 우측에 `$29` (레드 컬러 + Glow 효과).
*   **카피:** "아직도 비싸게 하십니까?"
*   **목표:** Decoy Pricing 구조를 직관적으로 인지시켜 클릭 유도.

### [Option B] The Ticking Bomb (긴박함 강조형)
*   **구성:** 중앙에 거대한 디지털 타이머(`72:00:00`)와 함께 화면 가장자리에 빨간색 비네팅(Vignetting) 효과.
*   **카피:** "종료까지 단 72시간"
*   **목표:** 마감 임박을 시각화하여 즉각적인 행동 유도.

### [Option C] The Glitch Alert (경고/충격형)
*   **구성:** 화면 전체가 깨진 듯한 글리치 효과와 함께 `⚠️ STOP!` 문구가 중앙 배치. 배경에는 빨간 경고등이 깜빡이는 레이어 삽입.
*   **카피:** "당신의 사업은 안전합니까?"
*   **목표:** 스크롤을 멈추게 하는 강력한 시각적 후킹(Stop-scrolling).

---

## 4. 영상 오버레이 에셋 제작 가이드 (Video Overlay Specs)

### ① 0~2s Hook: Glitch Overlay
- **효과:** RGB Split (Red, Blue, Green 채널 분리) + Frame Jitter (프레임 떨림).
- **지침:** 영상의 첫 2초간 프레임이 무작위로 1~2프레임씩 앞뒤로 튀는 효과를 적용하여 시청자의 주의를 강제로 고정.

### ② 'Deadline' Timer Overlay
- **디자인:** 디지털 세그먼트(Digital Segment) 스타일의 숫자 폰트 사용.
- **애니메이션:** 숫자가 줄어들 때마다 미세한 'White Flash' 효과 삽입.
- **위치:** 화면 하단 중앙 또는 우측 상단 고정.

### ③ Red Warning Light (Vignette)
-**효과:** 화면 테두리에 `#FF0000` 색상의 부드러운 비네팅 적용.
-**애니메이션:** `Opacity: 30% ↔ 70%` 주기로 불규칙하게 깜빡임(Flicker). 마치 사이렌이 울리는 듯한 환경 조성.

---

## 5. 기술 사양 (Technical Specifications)
- **Resolution:** 1080 x 1920 (Vertical, 9:16)
- **Frame Rate:** 30fps or 60fps (Glitch 효과의 부드러움을 위해 60fps 권장)
- **Export Format:**
    - Static Assets: `.png` (High Quality)
    - Overlay Assets: `.mov` (Apple ProRes 4444, Alpha Channel 포함하여 투명 배경 유지)

📊 평가: 완료 — 프로모션의 핵심 전략을 시각적 요소로 구체화하여 제작 가능한 수준의 브리프를 완성함.
📝 다음 단계: 위 브리프를 바탕으로 편집자(레오)가 영상 오버레이 에셋 및 썸네일을 제작하도록 전달.
