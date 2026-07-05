import React, { useState, useCallback } from 'react';
import {
  Play, TrendingUp, AlertTriangle, ListFilter,
  ArrowUpRight, ArrowDownRight, Database, Shuffle,
  RefreshCw, Info, Calendar
} from 'lucide-react';
import { BotConfig, MarketBar, Trade } from '../types';
import { generateMockHistory, computeIndicators, fetchRealCandleData } from '../utils';

interface Props { config: BotConfig; }

type DataSource = 'real' | 'mock';

interface BacktestResult {
  totalValue: number;
  totalPnLPercent: number;
  winRate: number;
  completedCount: number;
  winCount: number;
  lossCount: number;
  mdd: number;
  initialBalance: number;
  trades: Trade[];
  equityHistory: { time: string; value: number; drawdown: number; price: number }[];
  symbol: string;
  dataSource: DataSource;
  barCount: number;
  dateRange: string;
}

// ── 백테스트 엔진 (시뮬레이터 동일 로직) ─────────────────────────────────────
function runEngine(bars: MarketBar[], config: BotConfig): BacktestResult {
  const initialBalance = 1_000_000;
  let cash = initialBalance;
  let holdings = 0;
  let avgBuyPrice = 0;
  let peakValue = initialBalance;
  let maxDrawdown = 0;
  const trades: Trade[] = [];
  const equityHistory: { time: string; value: number; drawdown: number; price: number }[] = [];

  const computed = computeIndicators(bars, config);

  for (let i = 30; i < computed.length; i++) {
    const bar = computed[i];
    const currentPrice = bar.close;

    // ① 손절 / 익절
    if (holdings > 0 && avgBuyPrice > 0) {
      const pnl = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;
      if (pnl <= -config.stopLoss) {
        const amt = holdings * currentPrice;
        cash += amt;
        trades.push({ id: `sl-${i}`, type: 'STOP_LOSS', price: currentPrice, quantity: holdings, amount: amt, timestamp: bar.timestamp, timeString: bar.time, balanceAfter: cash, profitPercent: pnl, profitAmount: amt - holdings * avgBuyPrice });
        holdings = 0; avgBuyPrice = 0;
        equityHistory.push({ time: bar.time, value: cash, drawdown: 0, price: currentPrice });
        continue;
      }
      if (pnl >= config.takeProfit) {
        const amt = holdings * currentPrice;
        cash += amt;
        trades.push({ id: `tp-${i}`, type: 'TAKE_PROFIT', price: currentPrice, quantity: holdings, amount: amt, timestamp: bar.timestamp, timeString: bar.time, balanceAfter: cash, profitPercent: pnl, profitAmount: amt - holdings * avgBuyPrice });
        holdings = 0; avgBuyPrice = 0;
        equityHistory.push({ time: bar.time, value: cash, drawdown: 0, price: currentPrice });
        continue;
      }
    }

    // ② 5조건 스코어링
    const curr = computed[i], prev = computed[i - 1];
    const currRsi = curr.rsi ?? 50, prevRsi = prev.rsi ?? 50;
    const currMacd = curr.macd ?? 0, currSig = curr.macdSignal ?? 0;
    const prevMacd = prev.macd ?? 0, prevSig = prev.macdSignal ?? 0;
    const currHist = curr.macdHist ?? 0, prevHist = prev.macdHist ?? 0;

    const isGoldenCross  = prevMacd <= prevSig && currMacd > currSig;
    const isDeadCross    = prevMacd >= prevSig && currMacd < currSig;
    const histIncreasing = currHist > prevHist;
    const rsiCondition   = (currRsi > config.rsiOversold && currRsi <= 50 && currRsi > prevRsi)
                         || (prevRsi < 50 && currRsi >= 50);
    const aboveMA        = curr.ma20 != null && currentPrice > curr.ma20;
    const volumeAboveAvg = curr.volumeMA != null && curr.volume > curr.volumeMA;

    let buyScore = 0;
    if (isGoldenCross)   buyScore += 2;
    if (histIncreasing)  buyScore += 1;
    if (rsiCondition)    buyScore += 2;
    if (aboveMA)         buyScore += 1;
    if (volumeAboveAvg)  buyScore += 1;

    const lookback = computed.slice(Math.max(0, i - config.rsiLookback + 1), i + 1);
    const wasOverbought = lookback.some(b => (b.rsi ?? 50) >= config.rsiOverbought);

    if (buyScore >= 5 && holdings === 0) {
      const budget = cash * (config.tradeSize / 100);
      const qty = budget / currentPrice;
      cash -= budget; holdings = qty; avgBuyPrice = currentPrice;
      trades.push({ id: `buy-${i}`, type: 'BUY', price: currentPrice, quantity: qty, amount: budget, timestamp: bar.timestamp, timeString: bar.time, balanceAfter: cash });
    } else if (wasOverbought && isDeadCross && holdings > 0) {
      const amt = holdings * currentPrice;
      const profitAmt = amt - holdings * avgBuyPrice;
      const profitPct = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;
      cash += amt;
      trades.push({ id: `sell-${i}`, type: 'SELL', price: currentPrice, quantity: holdings, amount: amt, timestamp: bar.timestamp, timeString: bar.time, balanceAfter: cash, profitPercent: profitPct, profitAmount: profitAmt });
      holdings = 0; avgBuyPrice = 0;
    }

    const total = cash + holdings * currentPrice;
    peakValue = Math.max(peakValue, total);
    const dd = ((peakValue - total) / peakValue) * 100;
    maxDrawdown = Math.max(maxDrawdown, dd);
    equityHistory.push({ time: bar.time, value: total, drawdown: dd, price: currentPrice });
  }

  // 마지막 포지션 강제 청산
  const last = computed[computed.length - 1];
  if (holdings > 0) {
    const amt = holdings * last.close;
    const profitAmt = amt - holdings * avgBuyPrice;
    const profitPct = ((last.close - avgBuyPrice) / avgBuyPrice) * 100;
    cash += amt;
    trades.push({ id: 'final', type: 'SELL', price: last.close, quantity: holdings, amount: amt, timestamp: last.timestamp, timeString: last.time, balanceAfter: cash, profitPercent: profitPct, profitAmount: profitAmt });
  }

  const completed = trades.filter(t => t.type !== 'BUY');
  const wins = completed.filter(t => (t.profitPercent ?? 0) > 0);
  const totalPnLPercent = ((cash - initialBalance) / initialBalance) * 100;

  return {
    totalValue: cash,
    totalPnLPercent,
    winRate: completed.length > 0 ? (wins.length / completed.length) * 100 : 0,
    completedCount: completed.length,
    winCount: wins.length,
    lossCount: completed.length - wins.length,
    mdd: maxDrawdown,
    initialBalance,
    trades,
    equityHistory,
    symbol: config.symbol,
    dataSource: 'real',
    barCount: computed.length,
    dateRange: computed.length > 0 ? `${computed[0].time} ~ ${computed[computed.length - 1].time}` : '',
  };
}

// ── Equity Chart ──────────────────────────────────────────────────────────────
function EquityChart({ result }: { result: BacktestResult }) {
  const history = result.equityHistory;
  if (history.length < 5) return null;

  const W = 800, H = 180;
  const pad = { top: 15, right: 70, bottom: 20, left: 15 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;

  const stride = Math.max(1, Math.floor(history.length / 300));
  const sampled = history.filter((_, i) => i % stride === 0);
  if (sampled[sampled.length - 1] !== history[history.length - 1]) sampled.push(history[history.length - 1]);

  const vals = sampled.map(h => h.value);
  const minV = Math.min(...vals) * 0.985;
  const maxV = Math.max(...vals) * 1.015;

  const gx = (i: number) => pad.left + (i / (sampled.length - 1)) * cw;
  const gy = (v: number) => pad.top + ch - ((v - minV) / (maxV - minV)) * ch;

  let ePath = '';
  sampled.forEach((h, i) => {
    const x = gx(i), y = gy(h.value);
    ePath += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });
  const fillPath = `${ePath} L ${gx(sampled.length - 1)} ${pad.top + ch} L ${gx(0)} ${pad.top + ch} Z`;

  // Mark buy/sell on chart
  const buyPrices = result.trades.filter(t => t.type === 'BUY').map(t => t.price);
  const minP = Math.min(...sampled.map(h => h.price));
  const maxP = Math.max(...sampled.map(h => h.price));
  const gprice = (p: number) => pad.top + ch - ((p - minP) / (maxP - minP)) * ch;

  let pricePath = '';
  sampled.forEach((h, i) => {
    const x = gx(i), y = gprice(h.price);
    pricePath += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });

  return (
    <div className="bg-slate-950 rounded-xl p-4 border border-slate-900 space-y-1">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">누적 자산 곡선 (Equity Curve)</span>
        <div className="flex gap-3 text-[9px] font-mono">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-emerald-400"></span>자산</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-slate-600"></span>주가</span>
        </div>
      </div>
      <div className="h-[150px] w-full">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full select-none">
          {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
            const v = maxV - r * (maxV - minV);
            const y = gy(v);
            return (
              <g key={i}>
                <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="#1e293b" strokeWidth="1" strokeDasharray="3,5" />
                <text x={W - pad.right + 5} y={y + 3} fill="#475569" fontSize="9" fontFamily="monospace">
                  {(v / 10000).toFixed(0)}만
                </text>
              </g>
            );
          })}
          {/* Price line (faint) */}
          <path d={pricePath} fill="none" stroke="#334155" strokeWidth="1" />
          {/* Equity area + line */}
          <path d={fillPath} fill="url(#eqGrad)" opacity="0.12" />
          <path d={ePath} fill="none" stroke="#10b981" strokeWidth="1.8" />
          {/* Axis labels */}
          <text x={pad.left} y={H - 3} fill="#475569" fontSize="9" fontFamily="monospace">{history[0].time}</text>
          <text x={W - pad.right} y={H - 3} fill="#475569" fontSize="9" fontFamily="monospace" textAnchor="end">{history[history.length - 1].time}</text>
          <defs>
            <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="text-[9px] text-slate-600 font-mono text-right">
        매수 신호 {result.trades.filter(t => t.type === 'BUY').length}회 · 매도/손절/익절 {result.completedCount}회
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────────
function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, days: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function BacktestPanel({ config }: Props) {
  const [dataSource, setDataSource] = useState<DataSource>('real');
  const [mockBars, setMockBars] = useState(500);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BacktestResult | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const oneYearAgo = addDays(today, -365);

  const [startDate, setStartDate] = useState<string>(toDateInput(oneYearAgo));
  const [endDate, setEndDate] = useState<string>(toDateInput(today));

  const applyPreset = useCallback((days: number) => {
    setStartDate(toDateInput(addDays(today, -days)));
    setEndDate(toDateInput(today));
  }, []);

  const getDateRangeError = (): string => {
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diffDays = (e.getTime() - s.getTime()) / 86400000;
    if (diffDays < 14) return '최소 2주(14일) 이상의 기간을 선택해주세요.';
    if (diffDays > 365) return '최대 1년(365일) 이하로 선택해주세요.';
    return '';
  };

  const run = async () => {
    const rangeError = dataSource === 'real' ? getDateRangeError() : '';
    if (rangeError) { setError(rangeError); return; }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      let bars: MarketBar[];
      let src: DataSource = dataSource;

      if (dataSource === 'real') {
        const s = new Date(startDate);
        const e = new Date(endDate);
        const rangeDays = (e.getTime() - s.getTime()) / 86400000;
        // trading days ≈ range × 5/7, add 30-bar buffer for indicator warm-up
        const fetchCount = Math.min(Math.round(rangeDays * 5 / 7) + 30, 300);

        try {
          const allBars = await fetchRealCandleData(config, fetchCount);
          if (allBars.length < 14) throw new Error('데이터 부족');
          // filter to selected date range
          const sTs = s.getTime();
          const eTs = e.getTime() + 86400000; // end of selected day
          bars = allBars.filter(b => b.timestamp >= sTs && b.timestamp <= eTs);
          if (bars.length < 14) throw new Error(`선택 기간 내 데이터 부족 (${bars.length}개)`);
        } catch (err) {
          setError(`실제 데이터 로드 실패 (${err instanceof Error ? err.message : '네트워크 오류'}). 가상 데이터로 대체합니다.`);
          bars = generateMockHistory(mockBars, config);
          src = 'mock';
        }
      } else {
        bars = generateMockHistory(mockBars, config);
        src = 'mock';
      }

      await new Promise(r => setTimeout(r, 300));
      const r = runEngine(bars, config);
      r.dataSource = src;
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  };

  const STOCK_NAMES: Record<string, string> = {
    '005930': '삼성전자', '000660': 'SK하이닉스', '035420': 'NAVER',
    '005380': '현대자동차', '051910': 'LG화학', '035720': '카카오',
    '068270': '셀트리온', '207940': '삼성바이오로직스', '000270': '기아',
  };
  const symbolName = STOCK_NAMES[config.symbol] ?? config.symbol;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">

      {/* ── 설정 바 ── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-base font-bold text-slate-100">과거 데이터 백테스트</h2>
          <p className="text-xs text-slate-400 mt-1">
            설정된 전략을 실제 주가 역사 데이터에 적용해 수익률·승률·MDD를 검증합니다.
          </p>
        </div>

        <div className="flex flex-col gap-3 min-w-[260px]">
          {/* 데이터 소스 선택 */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1.5">데이터 소스</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDataSource('real')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  dataSource === 'real'
                    ? 'bg-emerald-900/40 border-emerald-600 text-emerald-400'
                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                <Database className="h-3.5 w-3.5" />
                실제 데이터
              </button>
              <button
                onClick={() => setDataSource('mock')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  dataSource === 'mock'
                    ? 'bg-amber-900/40 border-amber-600 text-amber-400'
                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                <Shuffle className="h-3.5 w-3.5" />
                가상 데이터
              </button>
            </div>
          </div>

          {/* 데이터 설명 / 날짜 범위 */}
          {dataSource === 'real' ? (
            <div className="flex flex-col gap-2">
              {/* 종목 정보 */}
              <div className="flex items-start gap-2 p-2.5 bg-emerald-950/30 border border-emerald-800/40 rounded-lg">
                <Database className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-[10px] text-slate-400 leading-relaxed">
                  <span className="text-emerald-300 font-bold">{config.symbol} {symbolName}</span> 일봉
                  (네이버 금융 · 최소 2주 ~ 최대 1년)
                </div>
              </div>
              {/* 프리셋 버튼 */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />기간 선택
                </label>
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {[
                    { label: '2주', days: 14 },
                    { label: '1개월', days: 30 },
                    { label: '3개월', days: 90 },
                    { label: '6개월', days: 180 },
                    { label: '1년', days: 365 },
                  ].map(p => (
                    <button
                      key={p.label}
                      onClick={() => applyPreset(p.days)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold text-slate-300 transition cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {/* 날짜 입력 */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] text-slate-500 mb-1">시작일</label>
                    <input
                      type="date"
                      value={startDate}
                      min={toDateInput(addDays(today, -365))}
                      max={endDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-300 px-2 py-1.5 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 mb-1">종료일</label>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      max={toDateInput(today)}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-300 px-2 py-1.5 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                {getDateRangeError() && (
                  <p className="text-[9px] text-rose-400 mt-1">{getDateRangeError()}</p>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">가상 봉 수</label>
              <select value={mockBars} onChange={e => setMockBars(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-300 px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500">
                <option value={300}>300봉 (약 12일, 1H)</option>
                <option value={500}>500봉 (약 20일, 1H)</option>
                <option value={1000}>1,000봉 (약 41일, 1H)</option>
                <option value={2190}>2,190봉 (약 1년, 4H)</option>
                <option value={8760}>8,760봉 (약 1년, 1H)</option>
              </select>
              <p className="text-[9px] text-amber-600 mt-1">⚠ 가상 데이터는 실제 주가와 무관합니다.</p>
            </div>
          )}

          {/* 실행 버튼 */}
          <button
            onClick={run}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            {loading
              ? <><RefreshCw className="h-4 w-4 animate-spin" />분석 중…</>
              : <><Play className="h-4 w-4" />백테스트 실행</>}
          </button>
        </div>
      </div>

      {/* ── 오류 ── */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-[11px] text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* ── 결과 ── */}
      {result ? (
        <div className="space-y-5">

          {/* 메타 정보 */}
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-slate-500">
            <span className="flex items-center gap-1">
              {result.dataSource === 'real'
                ? <><Database className="h-3 w-3 text-emerald-400" /><span className="text-emerald-400">실제 데이터</span></>
                : <><Shuffle className="h-3 w-3 text-amber-400" /><span className="text-amber-400">가상 데이터</span></>}
            </span>
            <span>종목: <span className="text-slate-300">{result.symbol} {symbolName}</span></span>
            <span>기간: <span className="text-slate-300">{result.dateRange}</span></span>
            <span>봉 수: <span className="text-slate-300">{result.barCount}개</span></span>
          </div>

          {/* KPI 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: '최종 자산',
                value: `${result.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}원`,
                sub: (
                  <span className={`flex items-center gap-0.5 text-[10px] font-bold mt-1.5 ${result.totalPnLPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {result.totalPnLPercent >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {result.totalPnLPercent >= 0 ? '+' : ''}{result.totalPnLPercent.toFixed(2)}%
                  </span>
                ),
              },
              {
                label: '거래 횟수',
                value: `${result.completedCount}회`,
                sub: <span className="text-[10px] text-slate-500 mt-1.5 block">매수 {result.trades.filter(t => t.type === 'BUY').length}회</span>,
              },
              {
                label: '승률',
                value: `${result.winRate.toFixed(1)}%`,
                valueClass: 'text-amber-400',
                sub: <span className="text-[10px] text-slate-500 mt-1.5 block">승 {result.winCount} / 패 {result.lossCount}</span>,
              },
              {
                label: '최대 낙폭 (MDD)',
                value: `-${result.mdd.toFixed(2)}%`,
                valueClass: 'text-rose-400',
                sub: <span className="text-[10px] text-slate-500 mt-1.5 block">고점 대비 최대 하락</span>,
              },
            ].map(card => (
              <div key={card.label} className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <p className="text-[11px] text-slate-500">{card.label}</p>
                <p className={`text-lg font-mono font-bold mt-1 ${(card as any).valueClass ?? 'text-slate-100'}`}>{card.value}</p>
                {card.sub}
              </div>
            ))}
          </div>

          {/* 전략 검증 메시지 */}
          <div className={`flex items-start gap-2.5 p-3 rounded-xl border text-[11px] leading-relaxed ${
            result.totalPnLPercent >= 5 && result.winRate >= 50
              ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
              : result.totalPnLPercent < 0
              ? 'bg-rose-950/30 border-rose-800/40 text-rose-300'
              : 'bg-amber-950/30 border-amber-800/40 text-amber-300'
          }`}>
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              {result.dataSource === 'real'
                ? `${result.symbol}(${symbolName}) 실제 일봉 ${result.barCount}개 기준 — `
                : `가상 시뮬레이션 ${result.barCount}봉 기준 — `}
              {result.totalPnLPercent >= 5 && result.winRate >= 50
                ? `수익률 ${result.totalPnLPercent.toFixed(1)}% · 승률 ${result.winRate.toFixed(0)}%로 전략이 이 기간 유효했습니다. 모의투자로 추가 검증을 권장합니다.`
                : result.totalPnLPercent < 0
                ? `이 기간 전략이 손실(-${Math.abs(result.totalPnLPercent).toFixed(1)}%)을 기록했습니다. 파라미터 조정 또는 종목 교체를 검토하세요.`
                : `수익률 ${result.totalPnLPercent.toFixed(1)}%로 제한적 성과입니다. 더 긴 기간 검증을 권장합니다.`}
            </span>
          </div>

          <EquityChart result={result} />

          {/* 거래 내역 */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-1.5">
              <ListFilter className="h-4 w-4 text-emerald-400" />
              매매 체결 내역 (최신순)
            </h3>
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden max-h-[240px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-800">
                  <tr className="text-slate-500 font-mono text-[10px]">
                    <th className="p-3">날짜</th>
                    <th className="p-3">구분</th>
                    <th className="p-3 text-right">체결가</th>
                    <th className="p-3 text-right">수량</th>
                    <th className="p-3 text-right">손익</th>
                    <th className="p-3 text-right">잔고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 font-mono">
                  {result.trades.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-600 text-xs">조건에 부합하는 거래가 없었습니다.</td></tr>
                  ) : result.trades.slice().reverse().map((t, i) => {
                    const isBuy = t.type === 'BUY';
                    const up = (t.profitPercent ?? 0) > 0;
                    const typeStyle = {
                      BUY: 'bg-emerald-500/10 text-emerald-400',
                      SELL: 'bg-amber-500/10 text-amber-400',
                      STOP_LOSS: 'bg-rose-500/10 text-rose-400',
                      TAKE_PROFIT: 'bg-indigo-500/10 text-indigo-400',
                    }[t.type];
                    return (
                      <tr key={i} className="hover:bg-slate-900/30">
                        <td className="p-2.5 text-slate-500 text-[10px]">{t.timeString}</td>
                        <td className="p-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${typeStyle}`}>
                            {t.type === 'BUY' ? '매수' : t.type === 'SELL' ? '매도' : t.type === 'STOP_LOSS' ? '손절' : '익절'}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-200">{t.price.toLocaleString()}</td>
                        <td className="p-2.5 text-right text-slate-500">{t.quantity.toFixed(4)}</td>
                        <td className={`p-2.5 text-right font-bold text-[10px] ${isBuy ? 'text-slate-600' : up ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isBuy ? '-' : `${up ? '+' : ''}${(t.profitPercent ?? 0).toFixed(2)}%`}
                        </td>
                        <td className="p-2.5 text-right text-slate-500 text-[10px]">{t.balanceAfter.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : !loading && (
        <div className="bg-slate-950/50 border border-slate-800 border-dashed rounded-xl p-10 text-center space-y-2">
          <TrendingUp className="h-10 w-10 text-slate-700 mx-auto" />
          <p className="text-sm font-bold text-slate-400">백테스트 결과 없음</p>
          <p className="text-xs text-slate-600 max-w-sm mx-auto">
            {dataSource === 'real'
              ? `"실제 데이터" 선택 시 ${config.symbol}(${symbolName})의 최근 약 200거래일 일봉을 기반으로 전략을 검증합니다.`
              : '가상 데이터로 지표 파라미터 조정 효과를 빠르게 확인할 수 있습니다.'}
          </p>
          <p className="text-[10px] text-slate-700">왼쪽 전략 패널에서 종목코드와 파라미터를 설정 후 실행하세요.</p>
        </div>
      )}
    </div>
  );
}
