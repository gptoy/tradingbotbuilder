import React, { useState, useCallback } from 'react';
import {
  Play, RefreshCw, AlertTriangle, Info, Database, Shuffle,
  ArrowUpRight, ArrowDownRight, ListFilter, Filter, Layers, Sparkles,
} from 'lucide-react';
import {
  ElephantConfig, DEFAULT_ELEPHANT_CONFIG, PARAM_RANGES, BreakoutMode, EntryMode, Timeframe,
  BacktestResult, ClosedTrade, RejectReason,
  runBacktest, generateMockCandles, toCandles, TIMEFRAME_MINUTES,
} from '../elephant';
import { fetchRealCandleData } from '../utils';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { Alert, AlertDescription } from './ui/alert';

type DataSource = 'mock' | 'real';

// ── 성과 곡선 ────────────────────────────────────────────────────────────────
function EquityChart({ result }: { result: BacktestResult }) {
  const history = result.equity;
  if (history.length < 5) return null;

  const W = 800, H = 180;
  const pad = { top: 15, right: 70, bottom: 20, left: 15 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;

  const stride = Math.max(1, Math.floor(history.length / 400));
  const sampled = history.filter((_, i) => i % stride === 0);
  if (sampled[sampled.length - 1] !== history[history.length - 1]) sampled.push(history[history.length - 1]);

  const vals = sampled.map(h => h.value);
  const minV = Math.min(...vals) * 0.99;
  const maxV = Math.max(...vals) * 1.01;
  const gx = (i: number) => pad.left + (i / (sampled.length - 1)) * cw;
  const gy = (v: number) => pad.top + ch - ((v - minV) / (maxV - minV || 1)) * ch;

  let ePath = '';
  sampled.forEach((h, i) => { ePath += (i === 0 ? 'M' : ' L') + ` ${gx(i)} ${gy(h.value)}`; });
  const fillPath = `${ePath} L ${gx(sampled.length - 1)} ${pad.top + ch} L ${gx(0)} ${pad.top + ch} Z`;

  const minP = Math.min(...sampled.map(h => h.price));
  const maxP = Math.max(...sampled.map(h => h.price));
  const gp = (p: number) => pad.top + ch - ((p - minP) / (maxP - minP || 1)) * ch;
  let pPath = '';
  sampled.forEach((h, i) => { pPath += (i === 0 ? 'M' : ' L') + ` ${gx(i)} ${gp(h.price)}`; });

  return (
    <Card className="p-4 space-y-1">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">누적 자산 곡선 (Equity Curve)</span>
        <div className="flex gap-3 text-[9px] font-mono">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-emerald-400" />자산</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-muted-foreground" />가격</span>
        </div>
      </div>
      <div className="h-[150px] w-full">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full select-none">
          {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
            const v = maxV - r * (maxV - minV);
            const y = gy(v);
            return (
              <g key={i}>
                <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="#1e293b" strokeWidth="1" strokeDasharray="3,5" opacity="0.4" />
                <text x={W - pad.right + 5} y={y + 3} fill="#64748b" fontSize="9" fontFamily="monospace">{(v / 10000).toFixed(0)}만</text>
              </g>
            );
          })}
          <path d={pPath} fill="none" stroke="#334155" strokeWidth="1" opacity="0.6" />
          <path d={fillPath} fill="url(#elGrad)" opacity="0.12" />
          <path d={ePath} fill="none" stroke="#10b981" strokeWidth="1.8" />
          <text x={pad.left} y={H - 3} fill="#64748b" fontSize="9" fontFamily="monospace">{history[0].time}</text>
          <text x={W - pad.right} y={H - 3} fill="#64748b" fontSize="9" fontFamily="monospace" textAnchor="end">{history[history.length - 1].time}</text>
          <defs>
            <linearGradient id="elGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </Card>
  );
}

const REJECT_LABELS: Record<RejectReason, string> = {
  ema200_filter: 'EMA200 추세 불일치',
  ema20_slope: 'EMA20 기울기 불일치',
  volume_filter: '거래량 미달',
  atr_filter: 'ATR 횡보 제외',
  position_open: '보유 포지션 존재',
  daily_loss_halt: '일일 손실 한도',
  consecutive_loss_halt: '연속 손절 중단',
  setup_expired: '셋업 만료(미돌파)',
};

const REASON_LABELS: Record<ClosedTrade['reason'], { label: string; variant: 'success' | 'destructive' | 'warning' | 'info' }> = {
  target:    { label: '목표청산', variant: 'success' },
  stop:      { label: '손절',     variant: 'destructive' },
  breakeven: { label: '본전청산', variant: 'warning' },
  opposite:  { label: '반대신호', variant: 'info' },
  timeout:   { label: '시간초과', variant: 'warning' },
  trail:     { label: '트레일링', variant: 'info' },
};

// ── 파라미터 슬라이더 ─────────────────────────────────────────────────────────
function ParamSlider({ label, range, value, onChange, fmt }: {
  label: string; range: { min: number; max: number; step: number }; value: number;
  onChange: (v: number) => void; fmt?: (v: number) => string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-mono text-muted-foreground flex justify-between">
        <span>{label}</span>
        <span className="text-foreground font-bold">{fmt ? fmt(value) : value}</span>
      </Label>
      <Slider min={range.min} max={range.max} step={range.step} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

// ── 메인 ───────────────────────────────────────────────────────────────────────
export default function ElephantPanel() {
  const [config, setConfig] = useState<ElephantConfig>({ ...DEFAULT_ELEPHANT_CONFIG });
  const [dataSource, setDataSource] = useState<DataSource>('mock');
  const [mockBars, setMockBars] = useState(1000);
  const [seed, setSeed] = useState(42);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BacktestResult | null>(null);

  const set = useCallback(<K extends keyof ElephantConfig>(k: K, v: ElephantConfig[K]) =>
    setConfig(prev => ({ ...prev, [k]: v })), []);

  const run = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      let candles;
      if (dataSource === 'real') {
        try {
          const bars = await fetchRealCandleData({ ...config, timeframe: '1h', marketType: 'stock' } as any, 300);
          if (bars.length < 60) throw new Error('데이터 부족');
          candles = toCandles(bars);
        } catch (e) {
          setError(`실데이터 로드 실패(${e instanceof Error ? e.message : '네트워크'}). 네이버 금융은 일봉만 제공하므로 5분봉 검증은 가상 데이터를 권장합니다. 가상 데이터로 대체합니다.`);
          candles = generateMockCandles(mockBars, config, seed);
        }
      } else {
        candles = generateMockCandles(mockBars, config, seed);
      }
      await new Promise(r => setTimeout(r, 250));
      setResult(runBacktest(candles, config));
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  };

  const rep = result?.report;
  const tfMin = TIMEFRAME_MINUTES[config.timeframe];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

      {/* ── 설정 사이드바 ── */}
      <aside className="xl:col-span-4 space-y-4">
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-[8px] bg-midnight-ink flex items-center justify-center">
              <Layers className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold">엘리펀트 캔들 전략</h2>
              <p className="text-[10px] text-muted-foreground">장대 캔들 돌파·되돌림 · {config.timeframe}봉</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">종목코드 / 심볼</Label>
            <Input value={config.symbol} onChange={e => set('symbol', e.target.value.trim())} placeholder="BTCUSDT / 005930" className="font-mono" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">봉 주기</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['1m', '3m', '5m', '15m'] as Timeframe[]).map(tf => (
                <Button key={tf} size="sm" variant={config.timeframe === tf ? 'default' : 'outline'} className="font-mono text-xs" onClick={() => set('timeframe', tf)}>
                  {tf}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* 탐지 */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Sparkles className="h-3 w-3" />엘리펀트 탐지</p>
            <ParamSlider label="평균 범위 기간" range={PARAM_RANGES.avgRangePeriod} value={config.avgRangePeriod} onChange={v => set('avgRangePeriod', v)} fmt={v => `${v}봉`} />
            <ParamSlider label="최소 범위 배수" range={PARAM_RANGES.minRangeMult} value={config.minRangeMult} onChange={v => set('minRangeMult', v)} fmt={v => `${v.toFixed(2)}×`} />
            <ParamSlider label="최소 몸통 비율" range={PARAM_RANGES.minBodyRatio} value={config.minBodyRatio} onChange={v => set('minBodyRatio', v)} fmt={v => `${(v * 100).toFixed(0)}%`} />
            <ParamSlider label="거래량 평균 기간" range={PARAM_RANGES.volumeMAPeriod} value={config.volumeMAPeriod} onChange={v => set('volumeMAPeriod', v)} fmt={v => `${v}봉`} />
            <ParamSlider label="최소 거래량 배수" range={PARAM_RANGES.minVolumeMult} value={config.minVolumeMult} onChange={v => set('minVolumeMult', v)} fmt={v => `${v.toFixed(2)}×`} />
          </div>

          <Separator />

          {/* 진입 */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">진입 방식</p>
            <div className="grid grid-cols-3 gap-1.5">
              {([['breakout', '돌파형'], ['pullback', '되돌림'], ['both', '둘 다']] as [EntryMode, string][]).map(([m, l]) => (
                <Button key={m} size="sm" variant={config.entryMode === m ? 'default' : 'outline'} className="text-[11px]" onClick={() => set('entryMode', m)}>{l}</Button>
              ))}
            </div>
            {(config.entryMode === 'breakout' || config.entryMode === 'both') && (
              <div className="grid grid-cols-2 gap-1.5">
                {([['WICK_BREAKOUT', '고저 돌파(엄격)'], ['BODY_BREAKOUT', '몸통 돌파(관대)']] as [BreakoutMode, string][]).map(([m, l]) => (
                  <Button key={m} size="sm" variant={config.breakoutMode === m ? 'blue' : 'outline'} className="text-[10px]" onClick={() => set('breakoutMode', m)}>{l}</Button>
                ))}
              </div>
            )}
            {(config.entryMode === 'pullback' || config.entryMode === 'both') && (
              <ParamSlider label="되돌림 깊이" range={PARAM_RANGES.pullbackDepth} value={config.pullbackDepth} onChange={v => set('pullbackDepth', v)} fmt={v => `${(v * 100).toFixed(0)}%`} />
            )}
            <ParamSlider label="셋업 만료" range={PARAM_RANGES.setupExpiryBars} value={config.setupExpiryBars} onChange={v => set('setupExpiryBars', v)} fmt={v => `${v}봉 (${v * tfMin}분)`} />
          </div>

          <Separator />

          {/* 필터 */}
          <div className="space-y-2.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Filter className="h-3 w-3" />추세·품질 필터</p>
            {([
              ['useEma200Filter', 'EMA200 추세 정렬'],
              ['useEma20Slope', 'EMA20 기울기 일치'],
              ['useVolumeFilter', '거래량 필터'],
              ['useAtrFilter', 'ATR 횡보 제외'],
            ] as [keyof ElephantConfig, string][]).map(([k, l]) => (
              <div key={k} className="flex items-center justify-between">
                <Label className="text-[11px] text-muted-foreground">{l}</Label>
                <Switch checked={config[k] as boolean} onCheckedChange={v => set(k, v as any)} />
              </div>
            ))}
          </div>

          <Separator />

          {/* 리스크 */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">리스크 & 청산</p>
            <ParamSlider label="거래당 위험" range={PARAM_RANGES.riskPerTradePct} value={config.riskPerTradePct} onChange={v => set('riskPerTradePct', v)} fmt={v => `${v.toFixed(2)}%`} />
            <ParamSlider label="최종 목표" range={PARAM_RANGES.finalTargetR} value={config.finalTargetR} onChange={v => set('finalTargetR', v)} fmt={v => `${v.toFixed(1)}R`} />
            <ParamSlider label="최대 보유" range={PARAM_RANGES.maxHoldBars} value={config.maxHoldBars} onChange={v => set('maxHoldBars', v)} fmt={v => `${v}봉 (${v * tfMin}분)`} />
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground">1R 도달 시 50% 부분청산 + 본전 이동</Label>
              <Switch checked={config.moveToBreakeven} onCheckedChange={v => set('moveToBreakeven', v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground">ATR 트레일링 스톱</Label>
              <Switch checked={config.useTrailingAtr} onCheckedChange={v => set('useTrailingAtr', v)} />
            </div>
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
              일일 손실 {config.dailyLossLimitPct}% 또는 연속 {config.maxConsecutiveLosses}회 손절 시 당일 신규 진입 중단 · 수수료 {config.feePct}%·슬리피지 {config.slippagePct}% 반영
            </p>
          </div>
        </Card>
      </aside>

      {/* ── 결과 영역 ── */}
      <section className="xl:col-span-8">
        <Card className="p-6 shadow-xl space-y-6">
          {/* 데이터 소스 + 실행 */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-5">
            <div>
              <h2 className="text-base font-bold">엘리펀트 백테스트</h2>
              <p className="text-xs text-muted-foreground mt-1">신호는 확정 봉에서만 발생, 체결은 다음 봉 시가 · 수수료·슬리피지 반영</p>
            </div>
            <div className="flex flex-col gap-3 min-w-[280px]">
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => setDataSource('mock')} variant={dataSource === 'mock' ? 'warning' : 'outline'} size="sm" className="text-xs font-bold">
                  <Shuffle className="h-3.5 w-3.5" />가상 5분봉
                </Button>
                <Button onClick={() => setDataSource('real')} variant={dataSource === 'real' ? 'success' : 'outline'} size="sm" className="text-xs font-bold">
                  <Database className="h-3.5 w-3.5" />실 일봉
                </Button>
              </div>
              {dataSource === 'mock' ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">봉 수</label>
                    <select value={mockBars} onChange={e => setMockBars(Number(e.target.value))}
                      className="w-full bg-card border border-input rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring">
                      {[500, 1000, 2000, 5000].map(v => <option key={v} value={v}>{v.toLocaleString()}봉</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">시드(재현)</label>
                    <Input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} className="font-mono text-xs h-auto py-1.5" />
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-amber-600">⚠ 네이버 금융은 일봉만 제공 → 실데이터는 일봉 기준 로직 검증용. 실제 5분봉은 거래소 API 연동 필요.</p>
              )}
              <Button onClick={run} disabled={loading} variant="success" className="w-full text-xs py-2.5 h-auto">
                {loading ? <><RefreshCw className="h-4 w-4 animate-spin" />분석 중…</> : <><Play className="h-4 w-4" />백테스트 실행</>}
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="warning"><AlertTriangle className="h-4 w-4" /><AlertDescription className="text-[11px]">{error}</AlertDescription></Alert>
          )}

          {result && rep ? (
            <div className="space-y-5">
              {/* 메타 */}
              <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-muted-foreground">
                <span>심볼: <span className="text-foreground">{config.symbol}</span></span>
                <span>기간: <span className="text-foreground">{result.dateRange}</span></span>
                <span>봉 수: <span className="text-foreground">{result.barCount.toLocaleString()}</span></span>
                <span>엘리펀트: <span className="text-foreground">{result.elephantCount}개</span></span>
                <span>신호: <span className="text-foreground">{result.signals.length}건</span></span>
              </div>

              {/* KPI */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard label="누적 수익률" value={`${rep.cumReturnPct >= 0 ? '+' : ''}${rep.cumReturnPct.toFixed(2)}%`}
                  cls={rep.cumReturnPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}
                  sub={<span className={cn('flex items-center gap-0.5 text-[10px] font-bold', rep.netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
                    {rep.netProfit >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {rep.netProfit.toLocaleString()}원
                  </span>} />
                <KpiCard label="승률" value={`${rep.winRate.toFixed(1)}%`} cls="text-amber-500"
                  sub={<span className="text-[10px] text-muted-foreground">승 {rep.winCount} / 패 {rep.lossCount}</span>} />
                <KpiCard label="Profit Factor" value={rep.profitFactor === Infinity ? '∞' : rep.profitFactor.toFixed(2)}
                  cls={rep.profitFactor >= 1.5 ? 'text-emerald-500' : rep.profitFactor >= 1 ? 'text-amber-500' : 'text-rose-500'}
                  sub={<span className="text-[10px] text-muted-foreground">손익비 {rep.payoffRatio.toFixed(2)}</span>} />
                <KpiCard label="최대 낙폭(MDD)" value={`-${rep.maxDrawdownPct.toFixed(2)}%`} cls="text-rose-500"
                  sub={<span className="text-[10px] text-muted-foreground">연속손절 {rep.maxConsecutiveLosses}회</span>} />
              </div>

              {/* 상세 지표 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ['총 거래', `${rep.totalTrades}회`],
                  ['평균 R', `${rep.avgRMultiple >= 0 ? '+' : ''}${rep.avgRMultiple.toFixed(2)}R`],
                  ['평균 수익', `${rep.avgWin.toLocaleString()}원`],
                  ['평균 손실', `${rep.avgLoss.toLocaleString()}원`],
                  ['샤프(거래기준)', rep.sharpe.toFixed(2)],
                  ['수수료 차감 전', `${rep.grossProfit.toLocaleString()}원`],
                  ['총 수수료', `-${rep.totalFees.toLocaleString()}원`],
                  ['최종 자산', `${rep.finalBalance.toLocaleString()}원`],
                ].map(([l, v]) => (
                  <div key={l} className="bg-muted/40 border border-border rounded-lg px-3 py-2">
                    <p className="text-[10px] text-muted-foreground">{l}</p>
                    <p className="text-sm font-mono font-bold text-foreground mt-0.5">{v}</p>
                  </div>
                ))}
              </div>

              {/* 검증 메시지 */}
              {(() => {
                const good = rep.cumReturnPct >= 5 && rep.winRate >= 45 && rep.profitFactor >= 1.3;
                const bad = rep.cumReturnPct < 0 || rep.profitFactor < 1;
                return (
                  <Alert variant={good ? 'success' : bad ? 'destructive' : 'warning'}>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-[11px] leading-relaxed">
                      {dataSource === 'mock' ? '가상' : '실'} 데이터 {result.barCount}봉 · 엘리펀트 {result.elephantCount}개 탐지 —{' '}
                      {good
                        ? `PF ${rep.profitFactor.toFixed(2)} · 승률 ${rep.winRate.toFixed(0)}% · 수익 ${rep.cumReturnPct.toFixed(1)}%로 이 구간 전략이 유효했습니다. 학습/검증 구간 분리와 복수 종목 재검증을 권장합니다.`
                        : bad
                        ? `이 구간 전략이 부진(PF ${rep.profitFactor === Infinity ? '∞' : rep.profitFactor.toFixed(2)}, 수익 ${rep.cumReturnPct.toFixed(1)}%)했습니다. 범위 배수·몸통 비율·필터를 조정하세요.`
                        : `제한적 성과(수익 ${rep.cumReturnPct.toFixed(1)}%)입니다. 더 긴 기간·다른 종목으로 재검증하세요.`}
                      {' '}※ 과최적화 방지를 위해 소수의 파라미터만 조정하세요.
                    </AlertDescription>
                  </Alert>
                );
              })()}

              <EquityChart result={result} />

              {/* 신호 거절 사유 */}
              {(Object.values(result.rejections) as number[]).some(v => v > 0) && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><Filter className="h-4 w-4 text-blue-400" />신호 거절 사유</h3>
                  <div className="flex flex-wrap gap-2">
                    {(Object.entries(result.rejections) as [RejectReason, number][])
                      .filter(([, v]) => v > 0)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, v]) => (
                        <Badge key={k} variant="ghost" className="text-[10px] font-mono">{REJECT_LABELS[k]} · {v}</Badge>
                      ))}
                  </div>
                </div>
              )}

              {/* 거래 내역 */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5"><ListFilter className="h-4 w-4 text-emerald-400" />매매 체결 내역 (최신순)</h3>
                <div className="bg-card border border-border rounded-xl overflow-hidden max-h-[280px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-card border-b border-border">
                      <tr className="text-muted-foreground font-mono text-[10px]">
                        <th className="p-2.5">진입시각</th>
                        <th className="p-2.5">방향</th>
                        <th className="p-2.5">진입</th>
                        <th className="p-2.5 text-right">진입가</th>
                        <th className="p-2.5 text-right">청산가</th>
                        <th className="p-2.5 text-right">R</th>
                        <th className="p-2.5 text-right">순손익</th>
                        <th className="p-2.5">청산</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {result.trades.length === 0 ? (
                        <tr><td colSpan={8} className="p-8 text-center text-muted-foreground text-xs">조건에 부합하는 거래가 없었습니다. 범위 배수를 낮추거나 필터를 완화해 보세요.</td></tr>
                      ) : result.trades.slice().reverse().map((t, i) => {
                        const up = t.netPnl > 0;
                        const r = REASON_LABELS[t.reason];
                        return (
                          <tr key={i} className="hover:bg-muted/30">
                            <td className="p-2 text-muted-foreground text-[10px]">{t.entryTime}</td>
                            <td className="p-2">
                              <Badge variant={t.direction === 'long' ? 'success' : 'destructive'} className="text-[9px] font-bold px-1.5 py-0.5 rounded">
                                {t.direction === 'long' ? '매수' : '매도'}
                              </Badge>
                            </td>
                            <td className="p-2 text-[10px] text-muted-foreground">{t.entryMode === 'breakout' ? '돌파' : '되돌림'}</td>
                            <td className="p-2 text-right text-foreground">{t.entryPrice.toLocaleString()}</td>
                            <td className="p-2 text-right text-muted-foreground">{t.exitPrice.toLocaleString()}</td>
                            <td className={cn('p-2 text-right font-bold text-[10px]', (t.rMultiple) >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
                              {t.rMultiple >= 0 ? '+' : ''}{t.rMultiple.toFixed(2)}
                            </td>
                            <td className={cn('p-2 text-right font-bold text-[10px]', up ? 'text-emerald-500' : 'text-rose-500')}>
                              {up ? '+' : ''}{t.netPnl.toLocaleString()}
                            </td>
                            <td className="p-2"><Badge variant={r.variant} className="text-[9px] px-1.5 py-0.5 rounded">{r.label}</Badge></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : !loading && (
            <Card className="border-dashed p-10 text-center space-y-2">
              <Layers className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm font-bold text-muted-foreground">엘리펀트 백테스트 결과 없음</p>
              <p className="text-xs text-muted-foreground/60 max-w-md mx-auto">
                왼쪽에서 탐지·진입·리스크 파라미터를 설정한 뒤 “백테스트 실행”을 누르세요.
                가상 5분봉은 시드로 동일 결과를 재현합니다. 명세서 §9의 결정적 검증 환경을 따릅니다.
              </p>
            </Card>
          )}
        </Card>
      </section>
    </div>
  );
}

function KpiCard({ label, value, cls, sub }: { label: string; value: string; cls?: string; sub?: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-mono font-bold mt-1', cls ?? 'text-foreground')}>{value}</p>
      <div className="mt-1.5">{sub}</div>
    </Card>
  );
}
