import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, BarChart3, Code2, BookOpen, Activity,
  TrendingUp, TrendingDown, Minus, RefreshCw, Clock,
  AlertTriangle, CheckSquare, Square, ChevronRight,
  Cpu, Settings, Play
} from 'lucide-react';
import { BotConfig } from './types';
import TradingSimulator from './components/TradingSimulator';
import BacktestPanel from './components/BacktestPanel';
import InteractiveCodeViewer from './components/InteractiveCodeViewer';
import SetupGuide from './components/SetupGuide';
import KisVerificationPanel from './components/KisVerificationPanel';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
type Tab = 'broker' | 'simulator' | 'backtest' | 'code' | 'guide';

interface IndexData {
  name: string;
  price: number;
  change: number;
  changeRate: number;
  direction: string;
  marketStatus?: string;
}
interface MarketIndices { kospi: IndexData; kosdaq: IndexData; usdkrw: IndexData; ts: number; }

// ──────────────────────────────────────────────────────────────────────────────
// Market Status Bar
// ──────────────────────────────────────────────────────────────────────────────
function MarketStatusBar() {
  const [data, setData] = useState<MarketIndices | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(0);

  const fetch_ = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const r = await fetch('/api/market/indices');
      if (r.ok) { setData(await r.json()); setLastFetch(Date.now()); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [loading]);

  useEffect(() => { fetch_(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const iv = setInterval(fetch_, 60_000);
    return () => clearInterval(iv);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const IndexChip = ({ d, label }: { d?: IndexData; label: string }) => {
    if (!d) return <span className="text-slate-600 text-[10px] font-mono">{label} --</span>;
    const up = d.direction === '2';
    const dn = d.direction === '5';
    const color = up ? 'text-rose-400' : dn ? 'text-blue-400' : 'text-slate-400';
    const Icon = up ? TrendingUp : dn ? TrendingDown : Minus;
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900/60 border border-slate-800 rounded-lg">
        <Icon className={`h-3 w-3 ${color}`} />
        <span className="text-[10px] text-slate-500 font-mono">{label}</span>
        <span className={`text-[11px] font-bold font-mono ${color}`}>
          {d.price.toLocaleString()}
        </span>
        <span className={`text-[9px] font-mono ${color}`}>
          {up ? '+' : dn ? '' : ''}{d.changeRate.toFixed(2)}%
        </span>
      </div>
    );
  };

  // KST 시장 시간 계산
  const now = new Date();
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const h = kst.getHours(), m = kst.getMinutes();
  const day = kst.getDay();
  const isWeekday = day >= 1 && day <= 5;
  const isOpen = isWeekday && (h > 9 || (h === 9 && m >= 0)) && h < 15;
  const isPreOpen = isWeekday && h === 8 && m >= 30;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
        isOpen ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400'
        : isPreOpen ? 'bg-amber-950/40 border-amber-800/50 text-amber-400'
        : 'bg-slate-900/60 border-slate-800 text-slate-500'
      }`}>
        <span className={`h-1.5 w-1.5 rounded-full ${isOpen ? 'bg-emerald-400 animate-pulse' : isPreOpen ? 'bg-amber-400' : 'bg-slate-600'}`} />
        {isOpen ? '장중' : isPreOpen ? '장전' : '장마감'}
      </div>
      <IndexChip d={data?.kospi} label="KOSPI" />
      <IndexChip d={data?.kosdaq} label="KOSDAQ" />
      <IndexChip d={data?.usdkrw} label="USD/KRW" />
      <button
        onClick={fetch_}
        disabled={loading}
        title="시세 새로고침"
        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-600 hover:text-slate-400 transition cursor-pointer disabled:opacity-40"
      >
        <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
      </button>
      {lastFetch > 0 && (
        <span className="text-[9px] text-slate-700 font-mono hidden sm:block">
          {new Date(lastFetch).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 기준
        </span>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Investment Checklist Sidebar
// ──────────────────────────────────────────────────────────────────────────────
const DEFAULT_CHECKLIST = [
  { id: 'mkt', text: '시장 전체 추세 확인 (KOSPI/KOSDAQ 방향)' },
  { id: 'signal', text: '자동매매 신호 확인 (매수후보 ≥5점)' },
  { id: 'rsi', text: 'RSI ≤30 과매도 구간 확인' },
  { id: 'macd', text: 'MACD 골든크로스 발생 여부' },
  { id: 'vol', text: '거래량이 이동평균 초과 여부' },
  { id: 'news', text: '종목 관련 주요 공시/뉴스 없음 확인' },
  { id: 'risk', text: '손절 라인(-2.5%) 설정 완료' },
  { id: 'size', text: '1회 주문액이 전체 자산 10% 이내' },
  { id: 'cred', text: 'API 연결 상태 정상 (Connected)' },
  { id: 'virtual', text: '모의투자로 먼저 검증 완료' },
];

function InvestmentChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setChecked(p => ({ ...p, [id]: !p[id] }));
  const count = Object.values(checked).filter(Boolean).length;
  const readyPct = Math.round((count / DEFAULT_CHECKLIST.length) * 100);

  return (
    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-emerald-400" />
          <h3 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">매매 전 점검 체크리스트</h3>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          readyPct === 100 ? 'bg-emerald-900/60 text-emerald-400' : 'bg-slate-800 text-slate-400'
        }`}>{count}/{DEFAULT_CHECKLIST.length}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${readyPct === 100 ? 'bg-emerald-500' : readyPct >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
          style={{ width: `${readyPct}%` }}
        />
      </div>

      <div className="space-y-1.5">
        {DEFAULT_CHECKLIST.map(item => (
          <button key={item.id} onClick={() => toggle(item.id)}
            className="w-full flex items-start gap-2 text-left hover:bg-slate-800/50 rounded-lg px-1.5 py-1 transition cursor-pointer group">
            {checked[item.id]
              ? <CheckSquare className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
              : <Square className="h-3.5 w-3.5 text-slate-600 shrink-0 mt-0.5 group-hover:text-slate-400" />}
            <span className={`text-[10px] leading-relaxed ${checked[item.id] ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
              {item.text}
            </span>
          </button>
        ))}
      </div>

      {readyPct === 100 && (
        <div className="p-2 bg-emerald-950/40 border border-emerald-800/40 rounded-lg text-[10px] text-emerald-400 text-center font-bold">
          ✅ 모든 항목 확인 완료 — 매매 준비 완료
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Risk Principles Panel
// ──────────────────────────────────────────────────────────────────────────────
function RiskPrinciples() {
  const rules = [
    { label: '손절 원칙', val: '-2.5% 이탈 시 무조건 손절', color: 'text-rose-400' },
    { label: '포지션 한도', val: '1종목 최대 자산 10%', color: 'text-amber-400' },
    { label: '진입 조건', val: 'MACD 골든크로스 + RSI 반등', color: 'text-emerald-400' },
    { label: '청산 조건', val: 'RSI 과열 이력 + 데드크로스', color: 'text-blue-400' },
    { label: '검증 순서', val: '모의 → 소액 실전 → 확대', color: 'text-purple-400' },
  ];
  return (
    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <h3 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">리스크 관리 원칙</h3>
      </div>
      <div className="space-y-2">
        {rules.map(r => (
          <div key={r.label} className="flex items-start gap-2">
            <ChevronRight className="h-3 w-3 text-slate-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-[9px] font-bold text-slate-500 block">{r.label}</span>
              <span className={`text-[10px] font-semibold ${r.color}`}>{r.val}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Trade Calendar (settlement dates)
// ──────────────────────────────────────────────────────────────────────────────
function TradeCalendar() {
  const addBusinessDays = (date: Date, n: number) => {
    const d = new Date(date);
    let added = 0;
    while (added < n) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) added++;
    }
    return d;
  };
  const fmtDate = (d: Date) =>
    d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' });

  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const d2 = addBusinessDays(now, 2);

  const rows = [
    { label: '오늘 (매수일)', val: fmtDate(now), note: '체결' },
    { label: 'D+2 (결제일)', val: fmtDate(d2), note: '현금 정산' },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
        <Clock className="h-4 w-4 text-blue-400" />
        <h3 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">결제 일정 & 매매 시간</h3>
      </div>
      <div className="space-y-1.5">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between text-[10px]">
            <span className="text-slate-500">{r.label}</span>
            <div className="text-right">
              <span className="text-slate-200 font-bold font-mono">{r.val}</span>
              <span className="text-slate-600 ml-1.5">({r.note})</span>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-800 pt-2.5 space-y-1 text-[10px]">
        <div className="flex justify-between text-slate-500">
          <span>정규장</span><span className="text-slate-300 font-mono">09:00 — 15:30</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>시간외 단일가</span><span className="text-slate-300 font-mono">15:40 — 18:00</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>장전 시간외</span><span className="text-slate-300 font-mono">08:30 — 09:00</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>수수료 (KIS 모바일)</span><span className="text-slate-300 font-mono">~0.015%</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>증권거래세 (매도)</span><span className="text-slate-300 font-mono">0.18% (2024)</span>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Strategy Config (collapsible, shown on simulator/backtest/code tabs)
// ──────────────────────────────────────────────────────────────────────────────
function StrategyConfig({ config, onChange }: { config: BotConfig; onChange: (k: keyof BotConfig, v: any) => void }) {
  return (
    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 space-y-5">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
        <Settings className="h-4 w-4 text-emerald-400" />
        <h3 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">전략 매개변수 설정</h3>
      </div>

      {/* Symbol & Timeframe */}
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 mb-1">종목코드</label>
          <input type="text" value={config.symbol} maxLength={6}
            onChange={e => onChange('symbol', e.target.value.trim())}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="005930" />
          <p className="text-[9px] text-slate-600 mt-1">005930 삼성 · 000660 SK하이닉스 · 035420 NAVER</p>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 mb-1">타임프레임</label>
          <div className="grid grid-cols-2 gap-1.5">
            {(['1h', '4h'] as const).map(tf => (
              <button key={tf} onClick={() => onChange('timeframe', tf)}
                className={`py-1.5 rounded-lg text-xs font-mono font-bold border transition cursor-pointer ${
                  config.timeframe === tf ? 'border-emerald-600 text-emerald-400 bg-emerald-950/30' : 'border-slate-800 text-slate-500 hover:text-slate-300'
                }`}>{tf === '1h' ? '1H봉' : '4H봉'}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Indicators */}
      <div className="space-y-3 border-t border-slate-800 pt-4">
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">지표 파라미터</p>
        {[
          { label: `MACD Fast/Slow: ${config.macdFast}/${config.macdSlow}`, children: (
            <div className="flex gap-2">
              <input type="range" min={5} max={20} value={config.macdFast} onChange={e => onChange('macdFast', +e.target.value)} className="w-1/2 accent-emerald-500 h-1 cursor-pointer" />
              <input type="range" min={21} max={40} value={config.macdSlow} onChange={e => onChange('macdSlow', +e.target.value)} className="w-1/2 accent-emerald-500 h-1 cursor-pointer" />
            </div>
          )},
          { label: `MACD Signal: ${config.macdSignal}`, children: <input type="range" min={3} max={15} value={config.macdSignal} onChange={e => onChange('macdSignal', +e.target.value)} className="w-full accent-emerald-500 h-1 cursor-pointer" /> },
          { label: `RSI 과매도: ≤${config.rsiOversold}`, children: <input type="range" min={20} max={45} value={config.rsiOversold} onChange={e => onChange('rsiOversold', +e.target.value)} className="w-full accent-blue-500 h-1 cursor-pointer" /> },
          { label: `RSI 과열: ≥${config.rsiOverbought}`, children: <input type="range" min={55} max={80} value={config.rsiOverbought} onChange={e => onChange('rsiOverbought', +e.target.value)} className="w-full accent-rose-500 h-1 cursor-pointer" /> },
          { label: `MA 기간: ${config.maPeriod}봉`, children: <input type="range" min={5} max={60} step={5} value={config.maPeriod} onChange={e => onChange('maPeriod', +e.target.value)} className="w-full accent-amber-500 h-1 cursor-pointer" /> },
        ].map(row => (
          <div key={row.label}>
            <div className="text-[10px] font-mono text-slate-400 mb-1">{row.label}</div>
            {row.children}
          </div>
        ))}
      </div>

      {/* Risk */}
      <div className="space-y-3 border-t border-slate-800 pt-4">
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">자금 & 리스크</p>
        {[
          { label: `진입 비중: ${config.tradeSize}%`, min: 5, max: 50, step: 5, val: config.tradeSize, key: 'tradeSize' as const, color: 'accent-emerald-500' },
          { label: `손절: -${config.stopLoss}%`, min: 1, max: 10, step: 0.5, val: config.stopLoss, key: 'stopLoss' as const, color: 'accent-rose-500' },
          { label: `익절: +${config.takeProfit}%`, min: 3, max: 20, step: 0.5, val: config.takeProfit, key: 'takeProfit' as const, color: 'accent-emerald-500' },
        ].map(row => (
          <div key={row.key}>
            <div className="text-[10px] font-mono text-slate-400 mb-1">{row.label}</div>
            <input type="range" min={row.min} max={row.max} step={row.step} value={row.val}
              onChange={e => onChange(row.key, +e.target.value)}
              className={`w-full ${row.color} h-1 cursor-pointer`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main App
// ──────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('broker');
  const [config, setConfig] = useState<BotConfig>({
    macdFast: 12, macdSlow: 26, macdSignal: 9,
    rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70,
    rsiLookback: 5, maPeriod: 20, volumeMAPeriod: 20,
    stopLoss: 2.5, takeProfit: 7.0, tradeSize: 10,
    timeframe: '1h', marketType: 'stock', symbol: '005930',
  });
  const [nowKst, setNowKst] = useState('');

  useEffect(() => {
    const tick = () => {
      const s = new Date().toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      });
      setNowKst(s);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  const handleConfigChange = (key: keyof BotConfig, value: any) =>
    setConfig(prev => ({ ...prev, [key]: value }));

  const isBrokerTab = activeTab === 'broker';

  const TABS: { id: Tab; icon: React.ReactNode; label: string; badge?: string }[] = [
    { id: 'broker',    icon: <ShieldCheck className="h-4 w-4" />, label: '증권사 연동', badge: 'MAIN' },
    { id: 'simulator', icon: <Activity className="h-4 w-4" />,    label: '전략 시뮬레이터' },
    { id: 'backtest',  icon: <BarChart3 className="h-4 w-4" />,   label: '과거 백테스트' },
    { id: 'code',      icon: <Code2 className="h-4 w-4" />,       label: '파이썬 코드' },
    { id: 'guide',     icon: <BookOpen className="h-4 w-4" />,    label: '구축 가이드' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Ambient glow */}
      <div className="absolute top-0 left-0 right-0 h-[280px] bg-gradient-to-b from-emerald-500/4 via-transparent to-transparent pointer-events-none" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="relative z-10 border-b border-slate-900 bg-slate-950/90 backdrop-blur-md px-6 py-3">
        <div className="flex flex-col gap-3">
          {/* Top row: brand + time */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
                <Cpu className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-base font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
                  자산 관리 자동매매 플랫폼
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
                    v4.0
                  </span>
                </h1>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  MACD + RSI 전략 · KIS / 토스 / 키움 실거래 연동 · 자동매매 엔진
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/60 border border-slate-800 rounded-lg text-[10px] font-mono text-slate-400">
              <Clock className="h-3 w-3 text-slate-600" />
              <span>{nowKst} KST</span>
            </div>
          </div>

          {/* Bottom row: market status */}
          <MarketStatusBar />
        </div>
      </header>

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav className="relative z-10 border-b border-slate-900 bg-slate-950/70 backdrop-blur-md px-6 py-0 flex items-end gap-1">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700'
            }`}>
            {tab.icon}
            {tab.label}
            {tab.badge && (
              <span className="text-[8px] font-black bg-emerald-600 text-white px-1.5 py-0.5 rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 p-5">
        {isBrokerTab ? (
          /* 증권사 연동 탭: 왼쪽 투자 보조 패널 + 오른쪽 KIS 패널 (넓게) */
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* Left: investor decision support */}
            <aside className="xl:col-span-3 space-y-4">
              <InvestmentChecklist />
              <RiskPrinciples />
              <TradeCalendar />
            </aside>

            {/* Right: broker integration (main content) */}
            <section className="xl:col-span-9">
              <KisVerificationPanel />
            </section>
          </div>
        ) : (
          /* 그 외 탭: 왼쪽 전략 설정 + 오른쪽 콘텐츠 */
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <aside className="xl:col-span-3">
              <StrategyConfig config={config} onChange={handleConfigChange} />
            </aside>
            <section className="xl:col-span-9">
              {activeTab === 'simulator' && <TradingSimulator config={config} />}
              {activeTab === 'backtest'  && <BacktestPanel config={config} />}
              {activeTab === 'code'      && <InteractiveCodeViewer config={config} />}
              {activeTab === 'guide'     && <SetupGuide />}
            </section>
          </div>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-900 py-4 px-6 flex items-center justify-between text-[10px] text-slate-600 font-mono relative z-10">
        <span>자산 관리 자동매매 플랫폼 — 개인 투자용, 투자 결과는 본인 책임입니다.</span>
        <span>React · TypeScript · Tailwind CSS · KIS OpenAPI</span>
      </footer>
    </div>
  );
}
