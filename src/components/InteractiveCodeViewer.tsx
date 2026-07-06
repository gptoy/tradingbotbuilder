import React, { useState } from 'react';
import { Clipboard, Check, Download, FileCode, AlertCircle } from 'lucide-react';
import { BotConfig } from '../types';
import { generatePythonCode } from '../codeGenerator';
import { Card, CardHeader, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { ScrollArea } from './ui/scroll-area';

interface Props { config: BotConfig; }

export default function InteractiveCodeViewer({ config }: Props) {
  const [copied, setCopied] = useState(false);
  const code = generatePythonCode(config);
  const lineCount = code.split('\n').length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain;charset=utf-8' }));
    a.download = 'macd_rsi_bot.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Card className="overflow-hidden flex flex-col">
      {/* Header */}
      <CardHeader className="border-b border-border bg-slate-950 rounded-none py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-rose-500" />
              <div className="h-3 w-3 rounded-full bg-amber-500" />
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
            </div>
            <FileCode className="h-4 w-4 text-slate-400" />
            <span className="font-mono text-sm font-semibold text-slate-200">macd_rsi_bot.py</span>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Python 3.8+</Badge>
            <Badge variant="ghost" className="text-xs text-slate-500">{lineCount} lines</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="sm"
              onClick={handleCopy}
              className="text-slate-300 hover:text-white hover:bg-slate-800 h-8 gap-1.5"
            >
              {copied ? <><Check className="h-3.5 w-3.5 text-emerald-400" /><span className="text-emerald-400">복사 완료</span></> : <><Clipboard className="h-3.5 w-3.5" />코드 복사</>}
            </Button>
            <Button size="sm" onClick={handleDownload} className="h-8 gap-1.5">
              <Download className="h-3.5 w-3.5" />
              다운로드
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Code Area */}
      <ScrollArea className="h-[520px] bg-slate-950">
        <div className="p-4 font-mono text-xs text-slate-300 leading-relaxed">
          <pre className="whitespace-pre">
            {code.split('\n').map((line, idx) => {
              let cls = 'text-slate-300';
              if (line.trim().startsWith('#') || line.trim().startsWith('"""')) cls = 'text-slate-500';
              else if (line.includes('def ') || line.includes('class ')) cls = 'text-pink-400';
              else if (/\b(if|elif|else|return|import|try|except|for|while)\b/.test(line)) cls = 'text-sky-400';
              else if (/\b(CONFIG|API_KEY|REAL_TRADE)\b/.test(line)) cls = 'text-orange-400';
              return (
                <div key={idx} className="flex hover:bg-slate-900/50 rounded">
                  <span className="inline-block w-10 text-right text-slate-600 select-none mr-4 shrink-0">{idx + 1}</span>
                  <span className={cls}>{line}</span>
                </div>
              );
            })}
          </pre>
        </div>
      </ScrollArea>

      {/* Footer */}
      <CardContent className="border-t border-border bg-muted/30 py-3">
        <Alert variant="warning" className="py-2.5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            실제 거래소 연동을 원할 경우 <code className="font-mono text-amber-700 bg-amber-100 px-1 rounded">REAL_TRADE = True</code>로 설정하고 API 키를 입력하세요. 기본값은 모의거래 시뮬레이션 모드입니다.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
