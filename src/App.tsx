import React, { useState } from 'react';
import {
  Settings,
  Play,
  BarChart3,
  Code2,
  ShieldAlert,
  TrendingUp,
  Coins,
  BookOpen,
  Cpu,
  Layers,
  Activity,
  HelpCircle,
  Percent,
  ShieldCheck
} from 'lucide-react';
import { BotConfig } from './types';
import TradingSimulator from './components/TradingSimulator';
import BacktestPanel from './components/BacktestPanel';
import InteractiveCodeViewer from './components/InteractiveCodeViewer';
import SetupGuide from './components/SetupGuide';
import KisVerificationPanel from './components/KisVerificationPanel';

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'backtest' | 'code' | 'guide' | 'kis-test'>('simulator');
  
  // Default configuration conforming to user's requirements
  const [config, setConfig] = useState<BotConfig>({
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    rsiPeriod: 14,
    rsiOversold: 30,
    rsiOverbought: 70,
    rsiLookback: 5,
    maPeriod: 20,
    volumeMAPeriod: 20,
    stopLoss: 2.5,
    takeProfit: 7.0,
    tradeSize: 10,
    timeframe: '1h',
    marketType: 'stock',
    symbol: '005930'
  });

  const handleConfigChange = (key: keyof BotConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Dynamic Ambient Top Glow */}
      <div className="absolute top-0 left-0 right-0 h-[320px] bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <Cpu className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
              알고리즘 트레이딩 봇 빌더
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono font-medium">
                V3.5 ACTIVE
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              MACD 골든/데드크로스 및 RSI 과매도 필터를 결합한 파이썬 자동 매매 스크립트 메이커 & 분석 센터
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3 text-xs font-mono bg-slate-900/60 border border-slate-800 rounded-lg p-2.5">
          <Activity className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
          <span className="text-slate-400">시스템 시간:</span>
          <span className="text-slate-200 font-bold">2026-06-30 (KST)</span>
        </div>
      </header>

      {/* Main Content Scaffold */}
      <main className="relative z-10 flex-1 grid grid-cols-1 xl:grid-cols-4 gap-6 p-6">
        
        {/* Left Side Parameter Configurator Panel (1 Col) */}
        <section className="xl:col-span-1 bg-slate-900 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between space-y-6">
          <div className="space-y-6">
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
              <Settings className="h-4.5 w-4.5 text-emerald-400" />
              <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">전략 매개변수 설정 (Configuration)</h2>
            </div>

            {/* Market Type and Target Selection */}
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5">대상 시장</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-600/10 border border-emerald-500/40 rounded-xl">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400">국내 주식 (KRX)</span>
                  <span className="ml-auto text-[10px] text-slate-500 font-mono">예수금 100만원</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5">종목코드 (6자리)</label>
                <input
                  type="text"
                  value={config.symbol}
                  onChange={(e) => handleConfigChange('symbol', e.target.value.trim())}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="005930"
                  maxLength={6}
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  005930 삼성전자 · 000660 SK하이닉스 · 035420 NAVER · 005380 현대차
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5">차트 타임프레임 (기본값: 1시간봉)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleConfigChange('timeframe', '1h')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-mono font-bold border transition cursor-pointer ${
                      config.timeframe === '1h' 
                        ? 'bg-slate-850 border-slate-700 text-emerald-400' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    1H (1시간봉)
                  </button>
                  <button
                    onClick={() => handleConfigChange('timeframe', '4h')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-mono font-bold border transition cursor-pointer ${
                      config.timeframe === '4h' 
                        ? 'bg-slate-850 border-slate-700 text-emerald-400' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    4H (4시간봉)
                  </button>
                </div>
              </div>
            </div>

            {/* Technical Parameters */}
            <div className="space-y-4 border-t border-slate-800/80 pt-4">
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">지표 매개변수 (Technical Indicators)</h3>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-400">MACD Fast / Slow</span>
                      <span className="text-slate-200 font-bold">{config.macdFast} / {config.macdSlow}</span>
                    </div>
                    <div className="flex space-x-2">
                      <input
                        type="range"
                        min="5"
                        max="20"
                        value={config.macdFast}
                        onChange={(e) => handleConfigChange('macdFast', Number(e.target.value))}
                        className="w-1/2 accent-emerald-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                      />
                      <input
                        type="range"
                        min="21"
                        max="40"
                        value={config.macdSlow}
                        onChange={(e) => handleConfigChange('macdSlow', Number(e.target.value))}
                        className="w-1/2 accent-emerald-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-400">MACD Signal Span</span>
                      <span className="text-slate-200 font-bold">{config.macdSignal}</span>
                    </div>
                    <input
                      type="range"
                      min="3"
                      max="15"
                      value={config.macdSignal}
                      onChange={(e) => handleConfigChange('macdSignal', Number(e.target.value))}
                      className="w-full accent-emerald-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-400">RSI Oversold (과매도 기준)</span>
                      <span className="text-blue-400 font-bold">≤ {config.rsiOversold}</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="45"
                      value={config.rsiOversold}
                      onChange={(e) => handleConfigChange('rsiOversold', Number(e.target.value))}
                      className="w-full accent-blue-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-400">RSI Overbought (과열 기준)</span>
                      <span className="text-rose-400 font-bold">≥ {config.rsiOverbought}</span>
                    </div>
                    <input
                      type="range"
                      min="55"
                      max="80"
                      value={config.rsiOverbought}
                      onChange={(e) => handleConfigChange('rsiOverbought', Number(e.target.value))}
                      className="w-full accent-rose-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-400">RSI 과열 Lookback</span>
                      <span className="text-slate-200 font-bold">{config.rsiLookback} 봉 이내</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={config.rsiLookback}
                      onChange={(e) => handleConfigChange('rsiLookback', Number(e.target.value))}
                      className="w-full accent-emerald-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-400">이동평균선 기간 (MA Period)</span>
                      <span className="text-amber-400 font-bold">{config.maPeriod}봉</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      step="5"
                      value={config.maPeriod}
                      onChange={(e) => handleConfigChange('maPeriod', Number(e.target.value))}
                      className="w-full accent-amber-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-400">거래량 MA 기간 (Volume MA)</span>
                      <span className="text-purple-400 font-bold">{config.volumeMAPeriod}봉</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      step="5"
                      value={config.volumeMAPeriod}
                      onChange={(e) => handleConfigChange('volumeMAPeriod', Number(e.target.value))}
                      className="w-full accent-purple-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Control */}
            <div className="space-y-4 border-t border-slate-800/80 pt-4">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">자금 및 리스크 제어 (Risk Rules)</h3>
              
              <div className="space-y-3.5 text-xs font-mono">
                <div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-slate-400">진입 자산 비중 (Trade Size)</span>
                    <span className="text-emerald-400 font-bold">{config.tradeSize}%</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="5"
                      max="50"
                      step="5"
                      value={config.tradeSize}
                      onChange={(e) => handleConfigChange('tradeSize', Number(e.target.value))}
                      className="flex-1 accent-emerald-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-slate-400">무조건 손절 기준 (Stop Loss)</span>
                    <span className="text-rose-400 font-bold">-{config.stopLoss}%</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="1.0"
                      max="10.0"
                      step="0.5"
                      value={config.stopLoss}
                      onChange={(e) => handleConfigChange('stopLoss', Number(e.target.value))}
                      className="flex-1 accent-rose-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-slate-400">익절 목표선 (Take Profit)</span>
                    <span className="text-emerald-400 font-bold">+{config.takeProfit}%</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="3.0"
                      max="20.0"
                      step="0.5"
                      value={config.takeProfit}
                      onChange={(e) => handleConfigChange('takeProfit', Number(e.target.value))}
                      className="flex-1 accent-emerald-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/60 text-[10px] text-slate-500 text-center leading-relaxed">
            모든 설정값은 소스코드 생성기 및 백테스터 엔진에 실시간으로 즉시 적용됩니다.
          </div>
        </section>

        {/* Right Side Tabs Container (3 Cols) */}
        <section className="xl:col-span-3 flex flex-col space-y-6">
          
          {/* Navigation Tabs bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-2 rounded-2xl">
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setActiveTab('simulator')}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'simulator' 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-650/20' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Activity className="h-4 w-4" />
                <span>1. 실시간 시뮬레이터</span>
              </button>

              <button
                onClick={() => setActiveTab('backtest')}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'backtest' 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-650/20' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                <span>2. 신속 과거 백테스트</span>
              </button>

              <button
                onClick={() => setActiveTab('code')}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'code' 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-650/20' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Code2 className="h-4 w-4" />
                <span>3. 생성된 파이썬 코드 (.py)</span>
              </button>

              <button
                onClick={() => setActiveTab('guide')}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'guide'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-650/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <BookOpen className="h-4 w-4" />
                <span>4. 구축 & 배포 가이드</span>
              </button>

              <button
                onClick={() => setActiveTab('kis-test')}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'kis-test'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-650/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                <span>5. 증권사 연동 검증</span>
              </button>
            </div>
            
            <div className="hidden sm:flex items-center space-x-2 px-3 text-xs text-slate-500 font-mono">
              <Layers className="h-3.5 w-3.5 text-slate-400" />
              <span>전략: MACD & RSI 돌파 결합</span>
            </div>
          </div>

          {/* Dynamic Tab Body Render */}
          <div className="flex-1">
            {activeTab === 'simulator' && <TradingSimulator config={config} />}
            {activeTab === 'backtest' && <BacktestPanel config={config} />}
            {activeTab === 'code' && <InteractiveCodeViewer config={config} />}
            {activeTab === 'guide' && <SetupGuide />}
            {activeTab === 'kis-test' && <KisVerificationPanel />}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500 font-mono mt-auto relative z-10">
        Designed for Algorithmic Trading Autopilot Systems. Made with React, TypeScript & Tailwind CSS.
      </footer>
    </div>
  );
}
