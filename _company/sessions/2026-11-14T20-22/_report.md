# 📝 CEO 종합 보고서

📺 레오: 작업 시작합니다.

사장님, YouTube Data API 키와 채널 ID를 입력받아 `~/secure/youtube_account.json` 파일에 저장하고, 파일 권한을 600으로 설정하도록 안내드립니다.

## 단계별 지침

1. **JSON 템플릿 생성**  
   아래 내용을 그대로 복사해 `youtube_account_template.txt` 라는 파일로 저장합니다.
   ```json
   {
       "YOUTUBE_API_KEY": "",
       "YOUTUBE_CHANNEL_ID": ""
   }
   ```

2. **파일 이동**  
   터미널에서 다음 명령을 실행해 홈 디렉토리의 `secure` 폴더에 복사합니다.  
   ```bash
   mkdir -p ~/secure
   cp youtube_account_template.txt ~/secure/youtube_account.json
   ```

3. **키 입력**  
   `~/secure/youtube_account.json` 파일을 열어 아래와 같이 실제 값으로 채워 주세요.  
   ```json
   {
       "YOUTUBE_API_KEY": "YOUR_ACTUAL_API_KEY",
       "YOUTUBE_CHANNEL_ID": "YOUR_CHANNEL_ID"
   }
   ```

4. **권한 설정**  
   터미널에서 다음 명령을 실행해 파일 권한을 600(소유자만 읽기/쓰기)으로 변경합니다.  
   ```bash
   chmod 600 ~/secure/youtube_account.json
   ```

5. **확인**  
   `cat` 혹은 `less` 로 내용이 정확히 입력되었는지 확인하고, 권한이 올바른지 `ls -l ~/secure/youtube_account.json` 으로 점검합니다.

### 예시 명령

```bash
# 1. 템플릿 생성
echo '{
    "YOUTUBE_API_KEY": "",
    "YOUTUBE_CHANNEL_ID": ""
}' > youtube_account_template.txt

# 2. secure 폴더 만들고 복사
mkdir -p ~/secure
cp youtube_account_template.txt ~/secure/youtube_account.json

# 3. 파일 편집 (vi, nano 등 사용)
nano ~/secure/youtube_account.json   # 실제 키 입력 후 저장

# 4. 권한 설정
chmod 600 ~/secure/youtube_account.json

# 5. 확인
ls -l ~/secure/youtube_account.json
cat ~/secure/youtube_account.json
```

> **주의**  
> * 파일 내용은 절대 공개하지 마세요.  
> * `~/secure` 폴더와 그 안의 파일이 다른 사용자에게 노출되지 않도록 보안 설정을 유지하세요.

필요한 추가 도구 실행이나 스크립트가 있으면 언제든 말씀해 주세요.  

📊 평가: 완료 — 지침은 명확하고 실천 가능한 단계로 정리됨  
📝 다음 단계: 사장님이 실제 키를 입력하고 권한을 설정하면, 저는 `youtube_account.json` 파일을 읽어 필요한 도구(`youtube_account`)를 실행하도록 준비합니다
