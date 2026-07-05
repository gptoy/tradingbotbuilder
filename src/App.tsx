import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, ShieldCheck, BarChart3, Activity, Code2,
  TrendingUp, TrendingDown, Minus, RefreshCw, Clock,
} from 'lucide-react';
import { BotConfig } from './types';
import DashboardPanel from './components/DashboardPanel';
import TradingSimulator from './components/TradingSimulator';
import BacktestPanel from './components/BacktestPanel';
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

type Tab = 'dashboard' | 'broker' | 'backtest' | 'simulator' | 'reference';

// ── Market Status Bar ─────────────────────────────────────────────────────────
interface IndexData {
  name: string; price: number; change: number; changeRate: number;
  direction: string;
}
interface MarketIndices { kospi: IndexData; kosdaq: IndexData; usdkrw: IndexData; ts: number; }

function MarketStatusBar() {
  const [data, setData] = useState<MarketIndices | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(0);

  const load = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const r = await fetch('/api/market/indices');
      if (r.ok) { setData(await r.json()); setLastFetch(Date.now()); }
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line
  useEffect(() => { const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, []); // eslint-disable-line

  const Chip = ({ d, label }: { d?: IndexData; label: string }) => {
    const up = d?.direction === '2', dn = d?.direction === '5';
    const col = up ? 'text-rose-600' : dn ? 'text-blue-600' : 'text-fog';
    const Icon = up ? TrendingUp : dn ? TrendingDown : Minus;
    return (
      <div className="flex items-center gap-1.5">
        {d ? (
          <>
            <Icon className={cn('h-3 w-3', col)} />
            <span className="text-[11px] text-fog">{label}</span>
            <span className={cn('text-[11px] font-bold font-mono', col)}>{d.price.toLocaleString()}</span>
            <span className={cn('text-[11px] font-mono', col)}>{up ? '+' : ''}{d.changeRate.toFixed(2)}%</span>
          </>
        ) : (
          <span className="text-[11px] text-fog font-mono">{label} --</span>
        )}
      </div>
    );
  };

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <Chip d={data?.kospi}  label="KOSPI" />
      <span className="text-ash">|</span>
      <Chip d={data?.kosdaq} label="KOSDAQ" />
      <span className="text-ash">|</span>
      <Chip d={data?.usdkrw} label="USD/KRW" />
      <Button variant="ghost" size="icon-sm" onClick={load} disabled={loading}>
        <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
      </Button>
      {lastFetch > 0 && (
        <span className="text-[11px] text-fog font-mono hidden md:block">
          {new Date(lastFetch).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준
        </span>
      )}
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
const TABS: { id: Tab; icon: React.ReactNode; label: string; sub: string }[] = [
  { id: 'dashboard',  icon: <LayoutDashboard className="h-4 w-4" />, label: '대시보드',    sub: '핵심 현황' },
  { id: 'broker',     icon: <ShieldCheck className="h-4 w-4" />,     label: '자동매매 연동', sub: 'KIS·Toss·키움' },
  { id: 'backtest',   icon: <BarChart3 className="h-4 w-4" />,       label: '백테스트',    sub: '과거 검증' },
  { id: 'simulator',  icon: <Activity className="h-4 w-4" />,        label: '시뮬레이터',  sub: '가상 매매' },
  { id: 'reference',  icon: <Code2 className="h-4 w-4" />,           label: '코드·가이드', sub: '개발 참고' },
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
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="px-6 py-2.5 flex items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="h-7 w-7 bg-midnight-ink rounded-[8px] flex items-center justify-center">
              <Activity className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-foreground leading-none">
                자산 관리 자동매매
              </h1>
              <p className="text-[10px] text-fog mt-0.5">MACD + RSI · KIS / Toss / 키움</p>
            </div>
            <Badge variant="outline" className="text-[9px] font-mono ml-1">v4.0</Badge>
          </div>

          {/* Market indices */}
          <div className="flex-1 hidden lg:block">
            <MarketStatusBar />
          </div>

          {/* KST clock */}
          <div className="flex items-center gap-1.5 text-[11px] text-fog font-mono shrink-0">
            <Clock className="h-3 w-3" />
            {nowKst} KST
          </div>
        </div>
      </header>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className="sticky top-[52px] z-30 border-b border-border bg-canvas-white/90 backdrop-blur-sm">
        <div className="px-4 flex items-end gap-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'group flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 cursor-pointer whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-electric-blue text-electric-blue'
                  : 'border-transparent text-fog hover:text-foreground hover:border-ash',
              )}
            >
              <span className={cn(
                'transition-colors',
                activeTab === tab.id ? 'text-electric-blue' : 'text-fog group-hover:text-foreground',
              )}>
                {tab.icon}
              </span>
              {tab.label}
              {tab.id === 'dashboard' && (
                <span className={cn(
                  'hidden sm:block text-[10px] font-normal',
                  activeTab === tab.id ? 'text-electric-blue/70' : 'text-fog',
                )}>
                  {tab.sub}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 p-5">

        {/* KisVerificationPanel: CSS hidden으로 항상 마운트 → auto-trade interval 유지 */}
        <div className={isBroker ? '' : 'hidden'}>
          <KisVerificationPanel />
        </div>

        {/* Dashboard: full-width */}
        {activeTab === 'dashboard' && (
          <DashboardPanel />
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
      <footer className="border-t border-border py-3 px-6 flex items-center justify-between text-[11px] text-fog font-mono">
        <span>개인 투자용 · 투자 결과는 본인 책임입니다</span>
        <span>React · TypeScript · Tailwind CSS v4 · shadcn/ui · KIS OpenAPI</span>
      </footer>
    </div>
  );
}
