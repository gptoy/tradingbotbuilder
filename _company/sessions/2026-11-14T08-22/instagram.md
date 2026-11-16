# 📷 Instagram — 최신 인스타그램 릴스에서 상위 10개 트렌딩 해시태그와 그 사용량, 관련 키워드를 수집하고, 이를 바탕으로 다음 주 릴

📷 Instagram: 작업 시작합니다.

현재 상황  
- Meta Graph API 인증 토큰 및 비즈니스 ID가 없으므로 트렌딩 해시태그를 직접 수집할 수 없습니다.  
- 과거 메모리에서 “상위 10개 트렌드” 데이터를 보유하고 있지 않으며, 24시간 이내에 동일 항목을 생성한 기록이 없습니다.

## 실행 계획
1. **Meta Graph API 접근 준비**  
   - `META_ACCESS_TOKEN`과 `INSTAGRAM_BUSINESS_ID`를 제공받아야 합니다.  
2. **트렌딩 해시태그 수집 스크립트 작성**  
   - 토큰 확보 후 `/ig_hashtag_search?user_id={BUSINESS_ID}&q=trend&fields=id,name,media_count` 등 엔드포인트 사용 계획.
3. **다음 주 릴스 전략 기획**  
   - 해시태그 10개와 사용량, 관련 키워드를 기반으로 3개의 릴스 컨셉, 캡션 및 해시태그 리스트를 설계.

## 현재 할 수 있는 일
- 토큰 제공 요청 메시지를 자동화해 전달합니다.  

---  

📊 평가: 대기 — Meta Graph API 자격증명 필요  
📝 다음 단계: 사용자에게 `META_ACCESS_TOKEN` 및 `INSTAGRAM_BUSINESS_ID` 입력 요청하기
