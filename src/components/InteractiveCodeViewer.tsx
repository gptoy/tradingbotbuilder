import React, { useState } from 'react';
import { Clipboard, Check, Download, FileCode, Play, AlertCircle } from 'lucide-react';
import { BotConfig } from '../types';
import { generatePythonCode } from '../codeGenerator';

interface Props {
  config: BotConfig;
}

export default function InteractiveCodeViewer({ config }: Props) {
  const [copied, setCopied] = useState(false);
  const code = generatePythonCode(config);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code: ', err);
    }
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([code], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `macd_rsi_bot.py`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* File Header */}
      <div className="flex justify-between items-center px-4 py-3 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <FileCode className="h-5 w-5 text-emerald-400" />
          <span className="font-mono text-sm font-semibold text-slate-200">macd_rsi_bot.py</span>
          <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
            Python 3.8+
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-750"
            title="코드 복사"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">복사 완료</span>
              </>
            ) : (
              <>
                <Clipboard className="h-3.5 w-3.5" />
                <span>코드 복사</span>
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition bg-emerald-600 text-white hover:bg-emerald-500"
            title="파일 다운로드"
          >
            <Download className="h-3.5 w-3.5" />
            <span>다운로드</span>
          </button>
        </div>
      </div>

      {/* Code Area */}
      <div className="flex-1 relative overflow-auto p-4 font-mono text-xs text-slate-300 leading-relaxed bg-slate-950 h-[480px]">
        <pre className="whitespace-pre">
          {code.split('\n').map((line, idx) => {
            // Very basic syntax highlighting for visual quality
            let lineElem = <span>{line}</span>;
            if (line.trim().startsWith('#') || line.trim().startsWith('"""') || line.trim().startsWith('*')) {
              lineElem = <span className="text-slate-500">{line}</span>;
            } else if (line.includes('def ') || line.includes('class ')) {
              lineElem = (
                <span>
                  <span className="text-pink-400">{line.slice(0, line.indexOf('def ') !== -1 ? line.indexOf('def ') + 4 : line.indexOf('class ') + 6)}</span>
                  <span className="text-amber-200">{line.slice(line.indexOf('def ') !== -1 ? line.indexOf('def ') + 4 : line.indexOf('class ') + 6)}</span>
                </span>
              );
            } else if (line.includes('if ') || line.includes('elif ') || line.includes('else:') || line.includes('return ') || line.includes('import ') || line.includes('try:') || line.includes('except')) {
              lineElem = <span className="text-sky-400">{line}</span>;
            } else if (line.includes('CONFIG') || line.includes('API_KEY')) {
              lineElem = <span className="text-orange-400">{line}</span>;
            }
            return (
              <div key={idx} className="flex hover:bg-slate-900/60 py-0.5 px-1 rounded">
                <span className="inline-block w-8 text-right text-slate-600 select-none mr-4">{idx + 1}</span>
                {lineElem}
              </div>
            );
          })}
        </pre>
      </div>

      {/* Logic Annotation Summary Footer */}
      <div className="p-4 bg-slate-900 border-t border-slate-800 text-xs text-slate-400 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-start space-x-2">
          <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-slate-300">💡 코드 사용 안내</p>
            <p className="text-slate-400">
              실제 거래소 연동을 원할 경우 <code className="text-amber-400 font-mono">REAL_TRADE = True</code>로 설정하고 API 키를 입력하세요. 기본값은 모의거래 시뮬레이션 모드입니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
