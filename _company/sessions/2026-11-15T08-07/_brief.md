# 📋 작업 브리프

**원 명령:** [자율 사이클 — 2026-11-15] 1인 기업 24시간 운영 중. 회사 목표·각 에이전트의 개인 목표(_agents/{id}/goal.md)·최근 의사결정·메모리를 검토해서 지금 가장 가치 있는 단일 작업 1개를 결정하고, 적절한 1~2명 에이전트에게 분배해서 실행하세요. 같은 산출물을 반복하지 마세요 — 메모리에 비슷한 항목이 24시간 내에 있으면 다른 각도로 진전시키세요.

## 요약
Instagram Graph API 토큰 자동 갱신 스크립트 재실행 및 권한 확인을 수행합니다.

## 분배
- **💻 코다리**: Python으로 Instagram Graph API 액세스 토큰을 OAuth 2.0 Client Credentials Grant 방식으로 자동 갱신하고, 새 토큰을 ~/.config/instagram/token.json에 저장하며 publish_video 권한이 있는지 확인해 실패 시 SLACK_WEBHOOK_URL로 에러
