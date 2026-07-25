import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, ShieldCheck, BarChart3, Activity, Code2, Layers, Globe,
  TrendingUp, TrendingDown, Minus, RefreshCw, Clock,
} from 'lucide-react';
import { BotConfig } from './types';
import DashboardPanel from './components/DashboardPanel';
import TradingSimulator from './components/TradingSimulator';
import BacktestPanel from './components/BacktestPanel';
import ElephantPanel from './components/ElephantPanel';
import NasdaqPanel from './components/NasdaqPanel';
import InteractiveCodeViewer from './components/InteractiveCodeViewer';
import SetupGuide from './components/SetupGuide';
import KisVerificationPanel from './components/KisVerificationPanel';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import { Slider } from './components/ui/slider';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card';
import { cn } from './lib/utils';

type Tab = 'dashboard' | 'broker' | 'nasdaq' | 'backtest' | 'elephant' | 'simulator' | 'reference';

// ── Market Status Bar ─────────────────────────────────────────────────────────
interface IndexData {
  name: string; price: number; change: number; changeRate: number;
  direction: string;
}
interface MarketIndices { kospi: IndexData; kosdaq: IndexData; usdkrw: IndexData; ts: number; }

function MarketStatusBar({ onRefresh }: { onRefresh?: () => void }) {
  const [data, setData] = useState<MarketIndices | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(0);

  const load = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const r = await fetch('/api/market/indices');
      if (r.ok) { setData(await r.json()); setLastFetch(Date.now()); onRefresh?.(); }
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line
  useEffect(() => { const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, []); // eslint-disable-line

  const IndexBlock = ({ d, label }: { d?: IndexData; label: string }) => {
    const up = d?.direction === '2', dn = d?.direction === '5';
    const col = up ? 'text-red-400' : dn ? 'text-blue-400' : 'text-[#80acd0]';
    const bg  = up ? 'text-red-500/80' : dn ? 'text-blue-500/80' : 'text-[#80acd0]';
    const arrow = up ? '▲' : dn ? '▼' : '—';
    return (
      <div className="flex items-baseline gap-2.5 px-4 border-r border-[#1e3a58] last:border-0">
        <span className="text-[10px] font-semibold text-[#80acd0] tracking-wide shrink-0">{label}</span>
        {d ? (
          <>
            <span className={cn('text-[15px] font-bold font-mono tabular-nums', col)}>
              {d.price.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
            </span>
            <span className={cn('text-[11px] font-mono tabular-nums', bg)}>
              {arrow} {Math.abs(d.change).toFixed(2)}
            </span>
            <span className={cn('text-[11px] font-mono font-semibold tabular-nums', col)}>
              {up ? '+' : dn ? '-' : ''}{Math.abs(d.changeRate).toFixed(2)}%
            </span>
          </>
        ) : (
          <span className="text-[15px] font-mono text-[#1e3a58]">—</span>
        )}
      </div>
    );
  };

  return (
    <div className="flex items-center">
      <IndexBlock d={data?.kospi}  label="KOSPI" />
      <IndexBlock d={data?.kosdaq} label="KOSDAQ" />
      <IndexBlock d={data?.usdkrw} label="USD/KRW" />
      <div className="pl-3">
        <button
          onClick={load} disabled={loading}
          className="p-1.5 rounded text-[#80acd0] hover:text-[#ecf5ff] hover:bg-[#162d4e] transition cursor-pointer"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
        </button>
        {lastFetch > 0 && (
          <div className="text-[9px] text-[#608ab0] font-mono text-center mt-0.5">
            {new Date(lastFetch).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Strategy Config Sidebar ───────────────────────────────────────────────────
function StrategyConfig({ config, onChange }: { config: BotConfig; onChange: (k: keyof BotConfig, v: any) => void }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">전략 파라미터</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-fog">종목코드</Label>
          <Input
            value={config.symbol} maxLength={6}
            onChange={e => onChange('symbol', e.target.value.trim())}
            placeholder="005930" className="font-mono"
          />
          <p className="text-[10px] text-fog">005930 삼성 · 000660 SK하이닉스 · 035420 NAVER</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-fog">타임프레임</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {(['1h', '4h'] as const).map(tf => (
              <Button key={tf} variant={config.timeframe === tf ? 'default' : 'outline'} size="sm"
                onClick={() => onChange('timeframe', tf)} className="font-mono text-xs">
                {tf === '1h' ? '1H봉' : '4H봉'}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <p className="text-[10px] font-bold text-fog uppercase tracking-wider">지표 파라미터</p>
          {[
            { label: `MACD Fast ${config.macdFast}`,     min: 5,  max: 20, step: 1,   val: config.macdFast,      key: 'macdFast'      as const },
            { label: `MACD Slow ${config.macdSlow}`,     min: 21, max: 40, step: 1,   val: config.macdSlow,      key: 'macdSlow'      as const },
            { label: `Signal ${config.macdSignal}`,      min: 3,  max: 15, step: 1,   val: config.macdSignal,    key: 'macdSignal'    as const },
            { label: `RSI 과매도 ≤${config.rsiOversold}`, min: 20, max: 45, step: 1,   val: config.rsiOversold,   key: 'rsiOversold'   as const },
            { label: `RSI 과열 ≥${config.rsiOverbought}`, min: 55, max: 80, step: 1,   val: config.rsiOverbought, key: 'rsiOverbought' as const },
            { label: `MA 기간 ${config.maPeriod}봉`,     min: 5,  max: 60, step: 5,   val: config.maPeriod,      key: 'maPeriod'      as const },
          ].map(row => (
            <div key={row.key} className="space-y-1.5">
              <Label className="text-[11px] font-mono text-fog">{row.label}</Label>
              <Slider min={row.min} max={row.max} step={row.step} value={[row.val]}
                onValueChange={([v]) => onChange(row.key, v)} />
            </div>
          ))}
        </div>

        <Separator />

        <div className="space-y-3">
          <p className="text-[10px] font-bold text-fog uppercase tracking-wider">자금 & 리스크</p>
          {[
            { label: `진입 비중 ${config.tradeSize}%`, min: 5, max: 50, step: 5,   val: config.tradeSize,  key: 'tradeSize'  as const },
            { label: `손절 -${config.stopLoss}%`,     min: 1, max: 10, step: 0.5, val: config.stopLoss,   key: 'stopLoss'   as const },
            { label: `익절 +${config.takeProfit}%`,   min: 3, max: 20, step: 0.5, val: config.takeProfit, key: 'takeProfit' as const },
          ].map(row => (
            <div key={row.key} className="space-y-1.5">
              <Label className="text-[11px] font-mono text-fog">{row.label}</Label>
              <Slider min={row.min} max={row.max} step={row.step} value={[row.val]}
                onValueChange={([v]) => onChange(row.key, v)} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS: { id: Tab; icon: React.ReactNode; label: string; badge?: string }[] = [
  { id: 'dashboard',  icon: <LayoutDashboard className="h-3.5 w-3.5" />, label: '대시보드' },
  { id: 'broker',     icon: <ShieldCheck className="h-3.5 w-3.5" />,     label: '자동매매',  badge: 'KIS·Toss' },
  { id: 'nasdaq',     icon: <Globe className="h-3.5 w-3.5" />,           label: '나스닥',    badge: 'US' },
  { id: 'backtest',   icon: <BarChart3 className="h-3.5 w-3.5" />,       label: '백테스트' },
  { id: 'elephant',   icon: <Layers className="h-3.5 w-3.5" />,          label: '엘리펀트',  badge: '5분봉' },
  { id: 'simulator',  icon: <Activity className="h-3.5 w-3.5" />,        label: '시뮬레이터' },
  { id: 'reference',  icon: <Code2 className="h-3.5 w-3.5" />,           label: '코드·가이드' },
];

// ── Reference tab (SetupGuide + Code) ────────────────────────────────────────
function ReferencePanel({ config }: { config: BotConfig }) {
  const [sub, setSub] = useState<'guide' | 'code'>('guide');
  return (
    <div>
      <div className="flex gap-1 mb-4">
        {(['guide', 'code'] as const).map(t => (
          <Button
            key={t}
            variant={sub === t ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSub(t)}
          >
            {t === 'guide' ? '구축 가이드' : '파이썬 코드'}
          </Button>
        ))}
      </div>
      {sub === 'guide' ? <SetupGuide /> : <InteractiveCodeViewer config={config} />}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [config, setConfig] = useState<BotConfig>({
    macdFast: 12, macdSlow: 26, macdSignal: 9,
    rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70,
    rsiLookback: 5, maPeriod: 20, volumeMAPeriod: 20, volumeThreshold: 1.5,
    stopLoss: 2.5, takeProfit: 7.0, tradeSize: 10,
    timeframe: '1h', marketType: 'stock', symbol: '005930',
  });
  const [nowKst, setNowKst] = useState('');

  useEffect(() => {
    const tick = () => setNowKst(
      new Date().toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      })
    );
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  const handleConfig = (key: keyof BotConfig, value: any) =>
    setConfig(prev => ({ ...prev, [key]: value }));

  const isBroker = activeTab === 'broker';
  const hasSidebar = activeTab === 'backtest' || activeTab === 'simulator';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-card backdrop-blur-md">
        <div className="flex items-stretch h-12">

          {/* Brand — fixed width left block */}
          <div className="flex items-center gap-2.5 px-4 border-r border-border shrink-0">
            <div className="h-6 w-6 bg-electric-blue rounded-[5px] flex items-center justify-center">
              <Activity className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <h1 className="text-[12px] font-bold tracking-tight text-foreground leading-none">
                자산 관리 자동매매
              </h1>
              <p className="text-[9px] text-fog mt-0.5 font-mono">KOSPI TOP 20 · MACD+RSI</p>
            </div>
          </div>

          {/* Market ticker — fills remaining space */}
          <div className="flex-1 flex items-center px-2 overflow-x-auto">
            <MarketStatusBar />
          </div>

          {/* Clock — right block */}
          <div className="flex items-center gap-2 px-4 border-l border-border shrink-0">
            <div className="text-right">
              <div className="text-[12px] font-mono font-bold text-foreground tabular-nums">{nowKst}</div>
              <div className="text-[9px] text-fog">KST</div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className="sticky top-12 z-30 border-b border-border bg-[#11243c]">
        <div className="flex items-stretch h-9 px-2 gap-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative flex items-center gap-1.5 px-3.5 text-[12px] font-medium transition-all cursor-pointer whitespace-nowrap',
                activeTab === tab.id
                  ? 'text-[#1d6ef8] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#1d6ef8]'
                  : 'text-fog hover:text-foreground hover:bg-[#152e48]/60',
              )}
            >
              <span className={cn(
                'transition-colors',
                activeTab === tab.id ? 'text-[#1d6ef8]' : 'text-fog',
              )}>
                {tab.icon}
              </span>
              {tab.label}
              {tab.badge && (
                <span className={cn(
                  'text-[8px] px-1 py-0.5 rounded font-mono',
                  activeTab === tab.id
                    ? 'bg-[#1d6ef8]/20 text-[#1d6ef8]'
                    : 'bg-[#1e3a58] text-[#80acd0]',
                )}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 p-4">

        {/* KisVerificationPanel: CSS hidden으로 항상 마운트 → auto-trade interval 유지 */}
        <div className={isBroker ? '' : 'hidden'}>
          <KisVerificationPanel />
        </div>

        {/* Dashboard: full-width */}
        {activeTab === 'dashboard' && (
          <DashboardPanel />
        )}

        {/* Elephant: full-width (자체 설정 사이드바 포함) */}
        {activeTab === 'elephant' && (
          <ElephantPanel />
        )}

        {/* NASDAQ: full-width */}
        {activeTab === 'nasdaq' && (
          <NasdaqPanel />
        )}

        {/* Backtest / Simulator: sidebar + content */}
        {hasSidebar && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <aside className="xl:col-span-3">
              <StrategyConfig config={config} onChange={handleConfig} />
            </aside>
            <section className="xl:col-span-9">
              {activeTab === 'simulator' && <TradingSimulator config={config} />}
              {activeTab === 'backtest'  && <BacktestPanel config={config} />}
            </section>
          </div>
        )}

        {/* Reference: full-width */}
        {activeTab === 'reference' && (
          <ReferencePanel config={config} />
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-2 px-4 flex items-center justify-between text-[10px] text-[#608ab0] font-mono">
        <span>⚠ 개인 투자용 · 투자 결과는 본인 책임입니다</span>
        <span>React 19 · TypeScript · Tailwind v4 · KIS OpenAPI · Toss OpenAPI</span>
      </footer>
    </div>
  );
}
