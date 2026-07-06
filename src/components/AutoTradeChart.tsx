import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { BotConfig, MarketBar, SignalClass } from '../types';
import { computeIndicators } from '../utils';

// ── Types ────────────────────────────────────────────────────────────────────
type Timeframe = '분' | '일' | '주' | '월' | '년';

export interface TradeMarker {
  timestamp: number;
  type: 'BUY' | 'SELL';
  price: number;
}

interface Props {
  symbol: string;
  position?: { qty: number; avgPrice: number } | null;
  signal?: SignalClass;
  lastPrice?: number;
  tradeMarkers?: TradeMarker[];
  stopLossPct?: number;
  takeProfitPct?: number;
}

// ── Constants ────────────────────────────────────────────────────────────────
const TF_NAVER: Record<Timeframe, string> = {
  '분': 'minute', '일': 'day', '주': 'week', '월': 'month', '년': 'month',
};
const TF_COUNT: Record<Timeframe, number> = {
  '분': 200, '일': 200, '주': 104, '월': 60, '년': 120,
};
const TF_VISIBLE: Record<Timeframe, number> = {
  '분': 120, '일': 60, '주': 52, '월': 36, '년': 9999,
};

const CHART_CFG: BotConfig = {
  macdFast: 12, macdSlow: 26, macdSignal: 9,
  rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70,
  rsiLookback: 5, maPeriod: 20, volumeMAPeriod: 20,
  stopLoss: 2.5, takeProfit: 7.0, tradeSize: 10,
  timeframe: '1h', marketType: 'stock', symbol: '',
};

// ── Layout constants ──────────────────────────────────────────────────────────
// W=1200 좌표계: 화면 너비에 따라 자연스럽게 스케일.
// 고정 style height 없음 → preserveAspectRatio="xMidYMid meet" 기본값으로
// viewBox 비율대로 높이가 결정되어 전체 너비를 채움.
const W     = 1200;

// Main chart: W:H = 1200:315 → 1360px 화면에서 약 357px
const MAIN_H = 315;
const PAD    = { top: 32, right: 108, bottom: 36, left: 10 };
const cW     = W - PAD.left - PAD.right;   // 1082
const cH     = MAIN_H - PAD.top - PAD.bottom; // 247

// MACD panel: W:H = 1200:109 → 1360px에서 약 124px
const MACD_H = 109;
const MPAD   = { top: 18, right: 108, bottom: 16, left: 10 };
const mcH    = MACD_H - MPAD.top - MPAD.bottom; // 75

// RSI panel: W:H = 1200:88 → 1360px에서 약 100px
const RSI_H  = 88;
const RPAD   = { top: 16, right: 108, bottom: 28, left: 10 };
const rcH    = RSI_H - RPAD.top - RPAD.bottom;  // 44

// Colors — light background
const GRID   = '#e2e8f0';  // slate-200
const LABEL  = '#475569';  // slate-600  — 가격 레이블
const AXIS   = '#64748b';  // slate-500  — x축 날짜
const ZERO   = '#cbd5e1';  // slate-300  — MACD 영선
const BAND   = '#f0fdf4';  // green-50   — RSI 밴드 배경
const OB     = '#fca5a5';  // red-300    — 과열선
const OS     = '#93c5fd';  // blue-300   — 과매도선

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseNaverCandles(
  raw: { date: string; open: number; high: number; low: number; close: number; volume: number }[],
  tf: Timeframe,
): MarketBar[] {
  const bars: MarketBar[] = raw
    .map(c => {
      const d = c.date;
      let ts: number;
      let timeLabel: string;

      if (tf === '분') {
        const y = d.slice(0, 4), mo = d.slice(4, 6), day = d.slice(6, 8);
        const h = d.slice(8, 10), mn = d.slice(10, 12);
        ts = new Date(`${y}-${mo}-${day}T${h}:${mn}:00+09:00`).getTime();
        timeLabel = `${h}:${mn}`;
      } else if (tf === '주') {
        ts = new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T00:00:00+09:00`).getTime();
        timeLabel = `${d.slice(2,4)}/${d.slice(4,6)}`;
      } else if (tf === '월' || tf === '년') {
        ts = new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T00:00:00+09:00`).getTime();
        timeLabel = `${d.slice(0,4)}/${d.slice(4,6)}`;
      } else {
        ts = new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T00:00:00+09:00`).getTime();
        timeLabel = `${d.slice(4,6)}/${d.slice(6,8)}`;
      }
      return { time: timeLabel, timestamp: ts, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume };
    })
    .filter(b => b.close > 0 && !isNaN(b.timestamp));

  bars.sort((a, b) => a.timestamp - b.timestamp);

  if (tf !== '년') return computeIndicators(bars, CHART_CFG);

  const byYear = new Map<number, MarketBar[]>();
  bars.forEach(b => {
    const y = new Date(b.timestamp).getFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(b);
  });
  const yearBars: MarketBar[] = [];
  byYear.forEach((months, year) => {
    const first = months[0], last = months[months.length - 1];
    yearBars.push({
      time: String(year),
      timestamp: first.timestamp,
      open: first.open,
      high: Math.max(...months.map(m => m.high)),
      low: Math.min(...months.map(m => m.low)),
      close: last.close,
      volume: months.reduce((s, m) => s + m.volume, 0),
    });
  });
  yearBars.sort((a, b) => a.timestamp - b.timestamp);
  return computeIndicators(yearBars, CHART_CFG);
}

// ── Component ────────────────────────────────────────────────────────────────
export default function AutoTradeChart({
  symbol,
  position,
  signal,
  lastPrice = 0,
  tradeMarkers = [],
  stopLossPct = 2.5,
  takeProfitPct = 7.0,
}: Props) {
  const [tf, setTf] = useState<Timeframe>('일');
  const [bars, setBars] = useState<MarketBar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stockName, setStockName] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const code = symbol.match(/\d{6}/)?.[0] ?? '';

  const fetchBars = useCallback(async (timeframe: Timeframe) => {
    if (!code) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/stock/${code}/candles?timeframe=${TF_NAVER[timeframe]}&count=${TF_COUNT[timeframe]}`,
        { signal: ctrl.signal },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      if (!Array.isArray(raw) || raw.length === 0) throw new Error('데이터 없음');
      setBars(parseNaverCandles(raw, timeframe));
    } catch (e: any) {
      if (e.name !== 'AbortError') setError(e.message ?? '로드 실패');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => { fetchBars(tf); }, [tf, fetchBars]);

  useEffect(() => {
    if (!code) return;
    fetch(`/api/stock/${code}/current`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.name) setStockName(d.name); })
      .catch(() => {});
  }, [code]);

  const visibleBars = bars.slice(-TF_VISIBLE[tf]);
  const n = visibleBars.length;

  if (n < 2) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <ChartHeader
          stockName={stockName} symbol={symbol} lastPrice={lastPrice}
          signal={signal} tf={tf} setTf={setTf} loading={loading}
          onRefresh={() => fetchBars(tf)}
        />
        <div className="flex items-center justify-center h-52 text-fog text-sm">
          {loading
            ? <><RefreshCw className="h-4 w-4 animate-spin mr-2 text-emerald-500" />데이터 로딩 중…</>
            : error
              ? <span className="text-rose-500">{error}</span>
              : '종목코드를 입력하면 차트가 표시됩니다'}
        </div>
      </div>
    );
  }

  // ── X coordinate ──────────────────────────────────────────────────────────
  const slotW  = cW / n;
  const bodyW  = Math.max(3, slotW * 0.65);
  const getX   = (i: number) => PAD.left + (i + 0.5) * slotW;

  // ── Price range ───────────────────────────────────────────────────────────
  const priceVals: number[] = [];
  visibleBars.forEach(b => {
    priceVals.push(b.high, b.low);
    if (b.ma20  != null) priceVals.push(b.ma20);
    if (b.ma60  != null) priceVals.push(b.ma60);
    if (b.ma120 != null) priceVals.push(b.ma120);
  });
  if (position)     priceVals.push(position.avgPrice);
  if (lastPrice > 0) priceVals.push(lastPrice);

  const rawMin = Math.min(...priceVals), rawMax = Math.max(...priceVals);
  const margin = (rawMax - rawMin) * 0.07;
  const pMin   = rawMin - margin, pMax = rawMax + margin;
  const getY   = (v: number) => PAD.top + cH * (1 - (v - pMin) / (pMax - pMin));

  // ── Volume ────────────────────────────────────────────────────────────────
  const vMax    = Math.max(...visibleBars.map(b => b.volume), 1);
  const volArea = cH * 0.16;
  const getVolH = (v: number) => (v / vMax) * volArea;

  // ── Price grid ────────────────────────────────────────────────────────────
  const priceTicks = [0, 0.2, 0.4, 0.6, 0.8, 1].map(r => pMin + r * (pMax - pMin));
  const labelEvery = Math.max(1, Math.floor(n / 8));

  // ── MA paths ──────────────────────────────────────────────────────────────
  let ma20Path = '', ma60Path = '', ma120Path = '';
  visibleBars.forEach((b, i) => {
    const x = getX(i);
    if (b.ma20  != null) ma20Path  += ma20Path  ? ` L${x},${getY(b.ma20)}`  : `M${x},${getY(b.ma20)}`;
    if (b.ma60  != null) ma60Path  += ma60Path  ? ` L${x},${getY(b.ma60)}`  : `M${x},${getY(b.ma60)}`;
    if (b.ma120 != null) ma120Path += ma120Path ? ` L${x},${getY(b.ma120)}` : `M${x},${getY(b.ma120)}`;
  });

  // ── Position / price lines ────────────────────────────────────────────────
  const avgBuyY  = position ? getY(position.avgPrice) : null;
  const slY      = position ? getY(position.avgPrice * (1 - stopLossPct  / 100)) : null;
  const tpY      = position ? getY(position.avgPrice * (1 + takeProfitPct / 100)) : null;
  const curY     = lastPrice > 0 ? getY(lastPrice) : null;

  // ── Marker tolerance ──────────────────────────────────────────────────────
  const tolerance: Record<Timeframe, number> = {
    '분': 2*60000, '일': 30*3600000, '주': 8*86400000, '월': 35*86400000, '년': 370*86400000,
  };

  // ── MACD ──────────────────────────────────────────────────────────────────
  const macds    = visibleBars.map(b => b.macd       ?? 0);
  const signals2 = visibleBars.map(b => b.macdSignal ?? 0);
  const hists    = visibleBars.map(b => b.macdHist   ?? 0);
  const maxAbsM  = Math.max(...macds.map(Math.abs), ...signals2.map(Math.abs), ...hists.map(Math.abs), 0.01);
  const getMY    = (v: number) => MPAD.top + mcH / 2 - (v / maxAbsM) * (mcH / 2);
  const zeroMY   = getMY(0);
  let macdPath = '', sigPath = '';
  visibleBars.forEach((b, i) => {
    const x = getX(i);
    const mY = getMY(b.macd ?? 0), sY = getMY(b.macdSignal ?? 0);
    macdPath += macdPath ? ` L${x},${mY}` : `M${x},${mY}`;
    sigPath  += sigPath  ? ` L${x},${sY}` : `M${x},${sY}`;
  });
  const lastMacd = visibleBars[n - 1]?.macd ?? 0;
  const lastSig  = visibleBars[n - 1]?.macdSignal ?? 0;

  // ── RSI ───────────────────────────────────────────────────────────────────
  const getRY = (v: number) => RPAD.top + rcH * (1 - v / 100);
  let rsiPath = '';
  visibleBars.forEach((b, i) => {
    const x = getX(i), y = getRY(b.rsi ?? 50);
    rsiPath += rsiPath ? ` L${x},${y}` : `M${x},${y}`;
  });
  const lastRsi = visibleBars[n - 1]?.rsi ?? 50;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-0">
      <ChartHeader
        stockName={stockName} symbol={symbol} lastPrice={lastPrice}
        signal={signal} tf={tf} setTf={setTf} loading={loading}
        onRefresh={() => fetchBars(tf)}
      />

      {error && !loading && (
        <div className="text-center py-3 text-sm text-rose-600 bg-rose-50 rounded-lg border border-rose-200 mt-3">
          {error}
        </div>
      )}
      {loading && (
        <div className="flex items-center justify-center h-44 text-fog text-sm">
          <RefreshCw className="h-5 w-5 animate-spin mr-2 text-emerald-500" /> 로딩 중…
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── Main candlestick chart ──────────────────────────────────── */}
          {/* viewBox W:H = 1200:370, no fixed CSS height → scales proportionally */}
          <svg viewBox={`0 0 ${W} ${MAIN_H}`} className="w-full block select-none mt-2">

            {/* Price grid */}
            {priceTicks.map((p, idx) => {
              const y = getY(p);
              if (y < PAD.top - 2 || y > MAIN_H - PAD.bottom + 2) return null;
              return (
                <g key={idx}>
                  <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                    stroke={GRID} strokeWidth="1" strokeDasharray="4,8" />
                  <text x={W - PAD.right + 6} y={y + 5} fill={LABEL} fontSize="13" fontFamily="monospace">
                    {p >= 100000
                      ? (p / 10000).toFixed(0) + '만'
                      : p >= 1000
                        ? Math.round(p).toLocaleString()
                        : Math.round(p * 10) / 10}
                  </text>
                </g>
              );
            })}

            {/* Volume (background) */}
            {visibleBars.map((b, i) => {
              const x = getX(i), vh = getVolH(b.volume);
              return (
                <rect key={`v${i}`} x={x - bodyW / 2} y={MAIN_H - PAD.bottom - vh}
                  width={bodyW} height={vh}
                  fill={b.close >= b.open ? '#10b981' : '#ef4444'} opacity="0.12" />
              );
            })}

            {/* MA lines */}
            {ma120Path && <path d={ma120Path} fill="none" stroke="#ec4899" strokeWidth="1.8" opacity="0.7" strokeDasharray="6,5" />}
            {ma60Path  && <path d={ma60Path}  fill="none" stroke="#38bdf8" strokeWidth="2.2" opacity="0.85" />}
            {ma20Path  && <path d={ma20Path}  fill="none" stroke="#f59e0b" strokeWidth="2.5" opacity="0.9" />}

            {/* Position lines */}
            {position && avgBuyY != null && avgBuyY >= PAD.top && avgBuyY <= MAIN_H - PAD.bottom && (
              <g>
                <line x1={PAD.left} y1={avgBuyY} x2={W - PAD.right} y2={avgBuyY}
                  stroke="#3b82f6" strokeWidth="2" strokeDasharray="6,5" />
                <rect x={PAD.left + 4} y={avgBuyY - 12} width={108} height={24} rx="5" fill="#3b82f6" />
                <text x={PAD.left + 10} y={avgBuyY + 5} fill="#fff" fontSize="13" fontFamily="monospace" fontWeight="bold">
                  평단 {position.avgPrice.toLocaleString()}
                </text>
              </g>
            )}
            {position && slY != null && slY >= PAD.top && slY <= MAIN_H - PAD.bottom && (
              <g>
                <line x1={PAD.left} y1={slY} x2={W - PAD.right} y2={slY}
                  stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,5" />
                <text x={W - PAD.right - 88} y={slY - 5} fill="#ef4444" fontSize="13" fontFamily="monospace" fontWeight="600">
                  손절 -{stopLossPct}%
                </text>
              </g>
            )}
            {position && tpY != null && tpY >= PAD.top && tpY <= MAIN_H - PAD.bottom && (
              <g>
                <line x1={PAD.left} y1={tpY} x2={W - PAD.right} y2={tpY}
                  stroke="#10b981" strokeWidth="1.5" strokeDasharray="4,5" />
                <text x={W - PAD.right - 88} y={tpY + 16} fill="#10b981" fontSize="13" fontFamily="monospace" fontWeight="600">
                  익절 +{takeProfitPct}%
                </text>
              </g>
            )}

            {/* Current price tag */}
            {curY != null && curY >= PAD.top && curY <= MAIN_H - PAD.bottom && (
              <g>
                <line x1={PAD.left} y1={curY} x2={W - PAD.right} y2={curY}
                  stroke="#10b981" strokeWidth="1.5" strokeDasharray="3,5" opacity="0.55" />
                <rect x={W - PAD.right + 1} y={curY - 12} width={PAD.right - 2} height={24} rx="4" fill="#10b981" />
                <text x={W - PAD.right + 7} y={curY + 5} fill="#fff" fontSize="13" fontFamily="monospace" fontWeight="bold">
                  {lastPrice.toLocaleString()}
                </text>
              </g>
            )}

            {/* Candlesticks */}
            {visibleBars.map((b, i) => {
              const x = getX(i);
              const isUp  = b.close >= b.open;
              const color = isUp ? '#10b981' : '#ef4444';
              const yHigh = getY(b.high), yLow = getY(b.low);
              const yTop  = getY(Math.max(b.open, b.close));
              const yBot  = getY(Math.min(b.open, b.close));
              const bH    = Math.max(2, yBot - yTop);
              return (
                <g key={`c${i}`}>
                  <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth="1.4" />
                  <rect x={x - bodyW / 2} y={yTop} width={bodyW} height={bH}
                    fill={color} fillOpacity={isUp ? 0.92 : 0.80} stroke={color} strokeWidth="0.4" />
                </g>
              );
            })}

            {/* Trade markers */}
            {tradeMarkers.map((m, idx) => {
              const bi = visibleBars.findIndex(b => Math.abs(b.timestamp - m.timestamp) < tolerance[tf]);
              if (bi === -1) return null;
              const x = getX(bi), y = getY(m.price);
              const isBuy  = m.type === 'BUY';
              const color  = isBuy ? '#10b981' : '#ef4444';
              const pts    = isBuy
                ? `${x},${y - 10} ${x - 8},${y + 3} ${x + 8},${y + 3}`
                : `${x},${y + 10} ${x - 8},${y - 3} ${x + 8},${y - 3}`;
              return (
                <g key={`t${idx}`}>
                  <polygon points={pts} fill={color} opacity="0.95" />
                  <text x={x} y={isBuy ? y - 15 : y + 22} fill={color} fontSize="12"
                    fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                    {isBuy ? '매수' : '매도'}
                  </text>
                </g>
              );
            })}

            {/* X-axis date labels */}
            {visibleBars.map((b, i) => {
              if (i % labelEvery !== 0) return null;
              return (
                <text key={`xl${i}`} x={getX(i)} y={MAIN_H - PAD.bottom + 20}
                  fill={AXIS} fontSize="13" fontFamily="monospace" textAnchor="middle">
                  {b.time}
                </text>
              );
            })}

            {/* MA legend */}
            <g>
              <circle cx={PAD.left + 10}  cy={PAD.top + 12} r="5" fill="#f59e0b" />
              <text x={PAD.left + 20} y={PAD.top + 17} fill="#b45309" fontSize="13" fontFamily="monospace" fontWeight="700">MA20</text>
              <circle cx={PAD.left + 74}  cy={PAD.top + 12} r="5" fill="#38bdf8" />
              <text x={PAD.left + 84} y={PAD.top + 17} fill="#0369a1" fontSize="13" fontFamily="monospace" fontWeight="700">MA60</text>
              <circle cx={PAD.left + 138} cy={PAD.top + 12} r="5" fill="#ec4899" />
              <text x={PAD.left + 148} y={PAD.top + 17} fill="#be185d" fontSize="13" fontFamily="monospace" fontWeight="700">MA120</text>
            </g>
          </svg>

          {/* ── MACD ────────────────────────────────────────────────────── */}
          <div className="border-t border-slate-100">
            <svg viewBox={`0 0 ${W} ${MACD_H}`} className="w-full block select-none">
              {/* Zero line */}
              <line x1={PAD.left} y1={zeroMY} x2={W - MPAD.right} y2={zeroMY}
                stroke={ZERO} strokeWidth="1.5" />
              {/* Histogram */}
              {visibleBars.map((b, i) => {
                const x = getX(i), zY = getMY(0), hY = getMY(b.macdHist ?? 0);
                const h = b.macdHist ?? 0;
                return (
                  <line key={`mh${i}`} x1={x} y1={zY} x2={x} y2={hY}
                    stroke={h >= 0 ? '#10b981' : '#ef4444'}
                    strokeWidth={Math.max(2.5, slotW * 0.58)} opacity="0.75" />
                );
              })}
              {/* MACD + Signal lines */}
              <path d={macdPath} fill="none" stroke="#0ea5e9" strokeWidth="2.2" />
              <path d={sigPath}  fill="none" stroke="#f59e0b" strokeWidth="2.2" />
              {/* Labels */}
              <text x={PAD.left + 6}  y={MPAD.top + 15} fill="#0ea5e9" fontSize="14" fontFamily="monospace" fontWeight="700">MACD</text>
              <text x={PAD.left + 72} y={MPAD.top + 15} fill="#f59e0b" fontSize="14" fontFamily="monospace" fontWeight="700">Signal</text>
              {/* Current values */}
              <text x={W - MPAD.right + 5} y={MPAD.top + 15}
                fill={lastMacd >= 0 ? '#10b981' : '#ef4444'}
                fontSize="14" fontFamily="monospace" fontWeight="bold">
                {lastMacd.toFixed(1)}
              </text>
              <text x={W - MPAD.right + 5} y={MPAD.top + 33}
                fill="#f59e0b" fontSize="12" fontFamily="monospace">
                {lastSig.toFixed(1)}
              </text>
            </svg>
          </div>

          {/* ── RSI ─────────────────────────────────────────────────────── */}
          <div className="border-t border-slate-100">
            <svg viewBox={`0 0 ${W} ${RSI_H}`} className="w-full block select-none">
              {/* OB/OS band */}
              <rect x={PAD.left} y={getRY(70)} width={cW} height={getRY(30) - getRY(70)} fill={BAND} />
              <line x1={PAD.left} y1={getRY(70)} x2={W - RPAD.right} y2={getRY(70)}
                stroke={OB} strokeWidth="1.4" strokeDasharray="5,5" />
              <line x1={PAD.left} y1={getRY(30)} x2={W - RPAD.right} y2={getRY(30)}
                stroke={OS} strokeWidth="1.4" strokeDasharray="5,5" />
              {/* RSI line */}
              <path d={rsiPath} fill="none" stroke="#a855f7" strokeWidth="2.4" />
              {/* Labels */}
              <text x={PAD.left + 6} y={RPAD.top + 14} fill="#a855f7" fontSize="14" fontFamily="monospace" fontWeight="700">RSI</text>
              <text x={W - RPAD.right + 5} y={getRY(70) + 5}  fill={OB} fontSize="12" fontFamily="monospace" fontWeight="600">70</text>
              <text x={W - RPAD.right + 5} y={getRY(30) + 5}  fill={OS} fontSize="12" fontFamily="monospace" fontWeight="600">30</text>
              <text x={W - RPAD.right + 5} y={RPAD.top + 14}
                fill={lastRsi >= 70 ? '#ef4444' : lastRsi <= 30 ? '#3b82f6' : '#a855f7'}
                fontSize="15" fontFamily="monospace" fontWeight="bold">
                {lastRsi.toFixed(1)}
              </text>
              {/* X-axis date labels (bottom) */}
              {visibleBars.map((b, i) => {
                if (i % labelEvery !== 0) return null;
                return (
                  <text key={`rl${i}`} x={getX(i)} y={RSI_H - RPAD.bottom + 18}
                    fill={AXIS} fontSize="13" fontFamily="monospace" textAnchor="middle">
                    {b.time}
                  </text>
                );
              })}
            </svg>
          </div>
        </>
      )}
    </div>
  );
}

// ── Chart Header ──────────────────────────────────────────────────────────────
function ChartHeader({
  stockName, symbol, lastPrice, signal, tf, setTf, loading, onRefresh,
}: {
  stockName: string; symbol: string; lastPrice: number;
  signal?: SignalClass; tf: Timeframe; setTf: (t: Timeframe) => void;
  loading: boolean; onRefresh: () => void;
}) {
  const sigStyle: Record<string, string> = {
    '매수후보': 'bg-emerald-100 text-emerald-700 border-emerald-300',
    '관심':    'bg-sky-100 text-sky-700 border-sky-300',
    '관망':    'bg-stone-100 text-stone-600 border-stone-300',
    '위험':    'bg-rose-100 text-rose-700 border-rose-300',
  };
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap pb-2">
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-foreground">{stockName || symbol}</span>
        {lastPrice > 0 && (
          <span className="text-base font-bold font-mono text-foreground">
            {lastPrice.toLocaleString()}<span className="text-xs text-fog ml-0.5 font-normal">원</span>
          </span>
        )}
        {signal && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${sigStyle[signal] ?? sigStyle['관망']}`}>
            {signal}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5 bg-paper-mist rounded-[8px] p-0.5">
          {(['분', '일', '주', '월', '년'] as Timeframe[]).map(t => (
            <button key={t} onClick={() => setTf(t)}
              className={`px-3 py-1.5 text-xs font-bold rounded-[6px] cursor-pointer transition ${
                tf === t
                  ? 'bg-canvas-white text-foreground shadow-sm'
                  : 'text-fog hover:text-foreground'
              }`}>{t}</button>
          ))}
        </div>
        <button onClick={onRefresh} disabled={loading}
          className="p-1.5 rounded-[8px] hover:bg-paper-mist text-fog hover:text-foreground cursor-pointer transition disabled:opacity-40">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
        </button>
      </div>
    </div>
  );
}
