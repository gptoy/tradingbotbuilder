import React, { useState } from 'react';
import { Terminal, Shield, PackageOpen, HelpCircle, CheckCircle2, Copy, Check } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

function CodeBlock({ code, id, label, copiedText, onCopy }:
  { code: string; id: string; label?: string; copiedText: string | null; onCopy: (text: string, id: string) => void }) {
  return (
    <div className="relative rounded-xl border border-border bg-slate-950 overflow-hidden">
      {label && <p className="px-4 pt-3 pb-1 text-xs text-slate-500 font-mono">{label}</p>}
      <div className="px-4 pb-3 pt-1 flex items-start justify-between gap-3">
        <pre className="text-sm font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap break-all">{code}</pre>
        <Button
          variant="ghost" size="icon-sm"
          onClick={() => onCopy(code, id)}
          className="shrink-0 text-slate-400 hover:text-white hover:bg-slate-800"
        >
          {copiedText === id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

export default function SetupGuide() {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-primary" />
          로컬 컴퓨터 배포 및 실행 가이드
          <Badge variant="secondary" className="text-xs">Quick Start</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-5">
        <Tabs defaultValue="env">
          <TabsList className="w-full grid grid-cols-4 mb-6">
            <TabsTrigger value="env"      className="text-xs gap-1"><HelpCircle className="h-3.5 w-3.5" />환경 구성</TabsTrigger>
            <TabsTrigger value="packages" className="text-xs gap-1"><PackageOpen className="h-3.5 w-3.5" />패키지</TabsTrigger>
            <TabsTrigger value="keys"     className="text-xs gap-1"><Shield className="h-3.5 w-3.5" />API 키</TabsTrigger>
            <TabsTrigger value="run"      className="text-xs gap-1"><CheckCircle2 className="h-3.5 w-3.5" />실행</TabsTrigger>
          </TabsList>

          <TabsContent value="env" className="space-y-4 mt-0">
            <p className="text-sm text-muted-foreground leading-relaxed">
              안정적인 자동매매 운영을 위해 파이썬 가상환경(Virtual Environment)을 구성하는 것을 권장합니다.
            </p>
            <div className="space-y-3">
              <CodeBlock id="env1" label="# 1. 파이썬 가상환경 생성" code="python -m venv trading_env" copiedText={copiedText} onCopy={copyToClipboard} />
              <CodeBlock id="env2" label="# 2. 가상환경 활성화 (macOS / Linux)" code="source trading_env/bin/activate" copiedText={copiedText} onCopy={copyToClipboard} />
              <CodeBlock id="env3" label="# 3. 가상환경 활성화 (Windows CMD)" code="trading_env\\Scripts\\activate" copiedText={copiedText} onCopy={copyToClipboard} />
            </div>
          </TabsContent>

          <TabsContent value="packages" className="space-y-4 mt-0">
            <p className="text-sm text-muted-foreground leading-relaxed">
              트레이딩 시스템 작동에 필요한 핵심 파이썬 패키지를 설치합니다.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { name: 'ccxt',         desc: '국내외 100개 이상의 가상자산 거래소 API를 통일하는 라이브러리' },
                { name: 'requests',     desc: 'KIS Open API 등과의 REST 통신 및 토큰 발급 담당' },
                { name: 'pandas',       desc: '시계열 데이터 처리 및 지표 계산에 활용' },
                { name: 'python-dotenv', desc: '.env 파일에서 API 키를 안전하게 로드' },
              ].map(p => (
                <div key={p.name} className="p-3.5 rounded-xl border border-border bg-muted/50">
                  <p className="font-bold text-sm text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
            <CodeBlock id="pkg" label="# 한 번에 필수 라이브러리 설치" code="pip install pandas requests ccxt python-dotenv" copiedText={copiedText} onCopy={copyToClipboard} />
          </TabsContent>

          <TabsContent value="keys" className="space-y-4 mt-0">
            <p className="text-sm text-muted-foreground leading-relaxed">
              실거래 주문 실행을 위해 거래소 API 키가 필요합니다. 보안을 위해 <code className="text-amber-600 font-mono bg-amber-50 px-1 rounded">.env</code> 파일로 관리하세요.
            </p>
            <CodeBlock
              id="key" label="# .env 파일 내용 예시"
              code={`EXCHANGE_API_KEY="your_api_public_key_here"\nEXCHANGE_SECRET_KEY="your_api_secret_private_key_here"`}
              copiedText={copiedText} onCopy={copyToClipboard}
            />
            <Alert variant="destructive">
              <Shield className="h-4 w-4" />
              <AlertDescription className="text-xs leading-relaxed">
                <strong>보안 주의:</strong> API Secret 키는 단 한 번만 조회 가능합니다. <code className="font-mono">.env</code> 파일은 반드시 <code className="font-mono">.gitignore</code>에 추가하여 GitHub에 커밋되지 않도록 하세요.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="run" className="space-y-4 mt-0">
            <p className="text-sm text-muted-foreground leading-relaxed">
              가상환경과 API 키 설정이 완료되었다면 아래 명령어로 봇을 실행합니다.
            </p>
            <div className="space-y-3">
              <CodeBlock id="run1" label="# 일반 터미널 실행" code="python macd_rsi_bot.py" copiedText={copiedText} onCopy={copyToClipboard} />
              <CodeBlock id="run2" label="# 리눅스 백그라운드 무중단 실행 (nohup)" code="nohup python -u macd_rsi_bot.py > trading.log 2>&1 &" copiedText={copiedText} onCopy={copyToClipboard} />
            </div>
            <Alert variant="success">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription className="text-xs">
                실행 중 로그는 <code className="font-mono">trading.log</code> 파일에서 확인할 수 있습니다.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
