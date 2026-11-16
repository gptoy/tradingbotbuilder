# 📷 Instagram — writer가 제공한 캡션과 해시태그를 사용하여 인스타그램 릴스를 9월 25일 오후 6시에 예약 게시하고, 게시 직전 알림 메시지를 1시간 전에 설정하라.

📷 Instagram: 작업 시작합니다.  
다음은 **9월 25일 오후 6시**에 예약 게시하고, **1시간 전(오후 5시)**에 알림 메시지를 자동으로 보낼 수 있는 스크립트와 cron 설정입니다.  

> *작성자는 실제 `META_ACCESS_TOKEN`과 `INSTAGRAM_BUSINESS_ID`를 환경 변수로 넣어 주셔야 합니다.*  
> *스크립트는 Mac/Linux 기준이며, Windows 사용 시 `cron` 대신 `Task Scheduler`에 맞게 변형해 주세요.*

```bash

