import React, { useState } from 'react';
import { Terminal, Shield, PackageOpen, HelpCircle, CheckCircle2, Copy, Check } from 'lucide-react';

export default function SetupGuide() {
  const [activeTab, setActiveTab] = useState<'env' | 'packages' | 'keys' | 'run'>('env');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'env':
        return (
          <div className="space-y-4 animate-fadeIn text-xs text-slate-300 leading-relaxed">
            <p className="text-slate-400">
              안정적인 자동매매 운영을 위해, 로컬 컴퓨터 또는 클라우드 서버(AWS EC2, 가비아 등)에 파이썬 가상환경(Virtual Environment)을 구성하는 것을 강력히 권장합니다.
            </p>
            <div className="space-y-3">
              <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl font-mono relative">
                <p className="text-slate-500 mb-1"># 1. 파이썬 가상환경 생성</p>
                <code className="text-emerald-400">python -m venv trading_env</code>
                <button 
                  onClick={() => copyToClipboard('python -m venv trading_env', 'env1')}
                  className="absolute right-3 top-3 text-slate-500 hover:text-white transition"
                >
                  {copiedText === 'env1' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl font-mono relative">
                <p className="text-slate-500 mb-1"># 2. 가상환경 활성화 (macOS / Linux)</p>
                <code className="text-emerald-400">source trading_env/bin/activate</code>
                <button 
                  onClick={() => copyToClipboard('source trading_env/bin/activate', 'env2')}
                  className="absolute right-3 top-3 text-slate-500 hover:text-white transition"
                >
                  {copiedText === 'env2' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl font-mono relative">
                <p className="text-slate-500 mb-1"># 3. 가상환경 활성화 (Windows Command Prompt)</p>
                <code className="text-emerald-400">trading_env\Scripts\activate</code>
                <button 
                  onClick={() => copyToClipboard('trading_env\\Scripts\\activate', 'env3')}
                  className="absolute right-3 top-3 text-slate-500 hover:text-white transition"
                >
                  {copiedText === 'env3' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        );
      case 'packages':
        return (
          <div className="space-y-4 animate-fadeIn text-xs text-slate-300 leading-relaxed">
            <p className="text-slate-400">
              트레이딩 시스템 작동에 필요한 4가지 핵심 파이썬 패키지를 설치합니다.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 border border-slate-855 p-3 rounded-xl">
                <p className="font-bold text-slate-200">ccxt</p>
                <p className="text-slate-500 mt-1">국내외 100개 이상의 가상자산 거래소(바이낸스, 업비트 등) API 규격을 통일해 주는 라이브러리.</p>
              </div>
              <div className="bg-slate-950 border border-slate-855 p-3 rounded-xl">
                <p className="font-bold text-slate-200">requests</p>
                <p className="text-slate-500 mt-1">한국투자증권(KIS) Open API 등 주식 거래소와의 REST 통신 및 계좌 토큰 발급을 담당하는 라이브러리.</p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl font-mono relative">
              <p className="text-slate-500 mb-1"># 한 번에 필수 라이브러리 설치하기</p>
              <code className="text-emerald-400">pip install pandas requests ccxt python-dotenv</code>
              <button 
                onClick={() => copyToClipboard('pip install pandas requests ccxt python-dotenv', 'pkg')}
                className="absolute right-3 top-3 text-slate-500 hover:text-white transition"
              >
                {copiedText === 'pkg' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        );
      case 'keys':
        return (
          <div className="space-y-4 animate-fadeIn text-xs text-slate-300 leading-relaxed">
            <p className="text-slate-400">
              실거래 주문 실행을 위해서는 거래소(또는 증권사) API 키가 연동되어야 합니다. 보안을 위해 소스코드에 키를 직접 적는 대신, <code className="text-amber-400 font-mono">.env</code> 텍스트 파일을 프로젝트 폴더 안에 생성하여 주입하는 방식을 강력 권장합니다.
            </p>
            <div className="bg-slate-950 border border-slate-850 p-3.5 rounded-xl font-mono relative">
              <p className="text-slate-500 mb-1"># .env 파일 생성 및 내용 예시</p>
              <pre className="text-sky-300">
{`EXCHANGE_API_KEY="your_api_public_key_here"
EXCHANGE_SECRET_KEY="your_api_secret_private_key_here"`}
              </pre>
              <button 
                onClick={() => copyToClipboard('EXCHANGE_API_KEY="your_api_public_key_here"\nEXCHANGE_SECRET_KEY="your_api_secret_private_key_here"', 'key')}
                className="absolute right-3 top-3 text-slate-500 hover:text-white transition"
              >
                {copiedText === 'key' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="p-3 bg-rose-950/20 border border-rose-900/30 rounded-xl flex items-start space-x-2">
              <Shield className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-rose-300 text-[11px]">
                <strong>보안 주의사항:</strong> 발급받은 API Secret 키는 단 한 번만 조회 가능하며 유출될 경우 자산 탈취 위험이 있습니다. <code className="text-rose-200">.env</code> 파일은 반드시 <code className="text-rose-200">.gitignore</code>에 추가하여 GitHub 등 공용 리포지토리에 커밋되지 않도록 하십시오.
              </p>
            </div>
          </div>
        );
      case 'run':
        return (
          <div className="space-y-4 animate-fadeIn text-xs text-slate-300 leading-relaxed">
            <p className="text-slate-400">
              가상환경이 활성화되고 라이브러리와 API 키 설정이 모두 끝났다면 아래 명령어로 즉시 자동매매 봇을 로컬 컴퓨터에서 백그라운드로 영구 가동시킬 수 있습니다.
            </p>
            <div className="space-y-3">
              <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl font-mono relative">
                <p className="text-slate-500 mb-1"># 일반 터미널 영구 가동 실행</p>
                <code className="text-emerald-400">python macd_rsi_bot.py</code>
                <button 
                  onClick={() => copyToClipboard('python macd_rsi_bot.py', 'run1')}
                  className="absolute right-3 top-3 text-slate-500 hover:text-white transition"
                >
                  {copiedText === 'run1' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl font-mono relative">
                <p className="text-slate-500 mb-1"># 리눅스 백그라운드 무중단 실행 (nohup)</p>
                <code className="text-emerald-400">nohup python -u macd_rsi_bot.py &gt; trading.log 2&gt;&1 &</code>
                <button 
                  onClick={() => copyToClipboard('nohup python -u macd_rsi_bot.py > trading.log 2>&1 &', 'run2')}
                  className="absolute right-3 top-3 text-slate-500 hover:text-white transition"
                >
                  {copiedText === 'run2' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center space-x-2">
        <Terminal className="h-5 w-5 text-emerald-400" />
        <h2 className="text-sm font-bold text-slate-200">로컬 컴퓨터 배포 및 실행 가이드 (Quick Start Guide)</h2>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-850 text-xs">
        <button
          onClick={() => setActiveTab('env')}
          className={`pb-2.5 px-4 font-semibold transition border-b-2 cursor-pointer ${
            activeTab === 'env' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          1. 환경 구성
        </button>
        <button
          onClick={() => setActiveTab('packages')}
          className={`pb-2.5 px-4 font-semibold transition border-b-2 cursor-pointer ${
            activeTab === 'packages' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          2. 패키지 설치
        </button>
        <button
          onClick={() => setActiveTab('keys')}
          className={`pb-2.5 px-4 font-semibold transition border-b-2 cursor-pointer ${
            activeTab === 'keys' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          3. API 키 설정 (.env)
        </button>
        <button
          onClick={() => setActiveTab('run')}
          className={`pb-2.5 px-4 font-semibold transition border-b-2 cursor-pointer ${
            activeTab === 'run' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          4. 봇 가동 실행
        </button>
      </div>

      {/* Dynamic Tab Body */}
      <div className="pt-2">
        {renderTabContent()}
      </div>
    </div>
  );
}
