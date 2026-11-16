# ✍️ Writer — 개발자가 스크립트에 적용할 수 있도록, 각 플랫폼 특성에 맞는 캡션 구성 규칙과 해시태그 포함 로직을 '규칙 기반(Rule-based)' 형태로 상세히 정리하여 개발자에게 전달하세요.

✍️ Writer: 작업 시작합니다.

코다리(Developer)가 구현 중인 `CaptionTransformer` 모듈의 로직을 완성하기 위한 **[플랫폼별 캡션 생성 규칙 명세서]**를 작성했습니다. 이 내용을 개발자에게 전달하여 `self.configs` 및 변환 로직(`_to_shorts`, `_to_reels`, `_to_feed`)에 즉시 반영할 수 있도록 설계했습니다.

---

# 📋 [개발 가이드] 플랫폼별 캡션 변환 규칙 (Rule-based Specification)

**대상:** `CaptionTransformer` 클래스 구현 로직
**목적:** YouTube 메타데이터(Title, Description, Tags)를 기반으로 각 플랫폼에 최적화된 텍кси트 구조 자동 생성

## 1. 공통 로직 (Common Logic)

### A. 해시태그 처리 규칙 (Hashtag Logic)
- **추출 원천:** YouTube `tags` 리스트를 우선 사용하되, 부족할 경우 `description`에서 `#`로 시작하는 단어를 추출함.
- **정규화:** 모든 태그는 소문자화(선택 사항) 및 앞뒤 공백 제거.
- **포맷팅:** 각 태그 사이에는 공백 한 칸(` `)을 삽입.

### B. 이모지 활용 규칙 (Emoji Logic)
- **Shorts/Reels:** 문장 끝 또는 핵심 키워드 뒤에 반드시 1~2개의 관련 이모지를 배치하여 시각적 주목도 향상.
- **Feed:** 가독성을 위해 불렛포인트(•, ✅, 📍) 용도로만 제한적으로 사용.

---

## 2. 플랫폼별 상세 변환 규칙 (Platform Specific Rules)

### ① YouTube Shorts (The "Hook" Focus)
*목표: 극도의 간결함과 즉각적인 호기심 유발*

| 항목 | 규칙 (Rule) |
| :--- | :--- |
| **텍스트 구성** | `[YouTube Title] + [Short Hook Emoji]` |
| **글자 수 제한** | 전체 100자 이동 (Title이 길 경우 앞부분만 절삭) |
| **해시태그** | 최대 3개 (가장 핵심적인 태그 3개 추출) |
| **특이 사항** | 설명란(Description)은 사용하지 않음. 오직 제목의 임팩트만 유지. |

### ② Instagram Reels (The "Engagement" Focus)
*목표: 요약된 정보와 행동 유도(CTA)를 통한 상호작용*

| 항목 | 규칙 (Rule) |
| :--- | :--- |
| **텍스트 구성** | `[Hook Sentence] + \n\n[Summary of Description] + \n\n[CTA]` |
| **글자 수 제한** | 전체 250자 내외 |
| **해시태그** | 최대 5개 (트렌드 관련 태그 포함) |
| **내용 로직** | 1. `Hook`: YouTube Title을 문장형으로 변환<br>2. `Summary`: Description의 첫 두 문장을 요약<br>3. `CTA`: "더 자세한 내용은 프로필 링크를 확인하세요!" 또는 "댓글로 의견을 남겨주세요!" 고정 삽입 |

### ③ Instagram/Facebook Feed (The "Value" Focus)
*목표: 상세 정보 전달 및 체류 시간 증대*

| 항목 | 규칙 (Rule) |
| :--- | :--- |
| **텍스트 구성** | `[Headline] + \n\n[Detailed Body] + \n\n[Value Prop/CTA] + \n\n[Hashtag Cloud]` |
| **글자 수 제한** | 500자 내외 (최대한 상세하게) |
| **해시태기** | 최대 10~15개 (연관 키워드 뭉치 형태) |
| **내용 로직** | 1. `Headline`: YouTube Title을 강조형으로 작성<br>2. `Body`: Description의 주요 내용을 불렛포인트(`•`)를 사용하여 구조화하여 나열<br>3. `Value Prop`: 이 콘텐츠가 주는 이득(Benefit) 한 줄 요약<br>4. `Spacing`: 가독성을 위해 문단 사이 반드시 빈 줄(`\n\n`) 삽입 |

---

## 3. 구현을 위한 Pseudo-Code 가이드 (for 코다리)

```python
def transform_to_reels(title, description, tags):
    # 1. Hook 생성 (Title 기반)
    hook = f"🔥 {title} 보셨나요?" 
    
    # 2. Summary 추출 (Description 첫 문장)
    summary = description.split('\n')[0]
    
    # 3. CTA 고정
    cta = "👉 프로필 링크에서 확인하세요!"
    
    # 4. Hashtags (Tags 리스트에서 5개 선택)
    hashtag_str = " ".join([f"#{t}" for t in tags[:5]])
    
    return f"{hook}\n\n{summary}\n\n{cta}\n\n{hashtag_str}"
```

---

📊 평가: 완료 — 개발자가 즉시 코드에 로직으로 치환할 수 있는 규칙 기반의 명세를 작성함.

📝 다음 단계: 코다리(Developer)가 위 규칙을 `caption_transformer.py`에 적용한 후, 테스트 결과 보고.
