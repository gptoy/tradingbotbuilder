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

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseNaverCandles(raw: { date: string; open: number; high: number; low: number; close: number; volume: number }[], tf: Timeframe): MarketBar[] {
  const bars: MarketBar[] = raw
    .map(c => {
      const d = c.date;
      let ts: number;
      let timeLabel: string;

      if (tf === '분') {
        // yyyyMMddHHmm (12 chars)
        const y = d.slice(0, 4), mo = d.slice(4, 6), day = d.slice(6, 8);
        const h = d.slice(8, 10), mn = d.slice(10, 12);
        ts = new Date(`${y}-${mo}-${day}T${h}:${mn}:00+09:00`).getTime();
        timeLabel = `${h}:${mn}`;
      } else if (tf === '주') {
        ts = new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00+09:00`).getTime();
        timeLabel = `${d.slice(2, 4)}/${d.slice(4, 6)}`;
      } else if (tf === '월' || tf === '년') {
        ts = new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00+09:00`).getTime();
        timeLabel = `${d.slice(0, 4)}/${d.slice(4, 6)}`;
      } else {
        // 일
        ts = new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00+09:00`).getTime();
        timeLabel = `${d.slice(4, 6)}/${d.slice(6, 8)}`;
      }
      return { time: timeLabel, timestamp: ts, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume };
    })
    .filter(b => b.close > 0 && !isNaN(b.timestamp));

  bars.sort((a, b) => a.timestamp - b.timestamp);

  if (tf !== '년') return computeIndicators(bars, CHART_CFG);

  // Aggregate monthly → yearly
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

  // Fetch stock name
  useEffect(() => {
    if (!code) return;
    fetch(`/api/stock/${code}/current`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.name) setStockName(d.name); })
      .catch(() => {});
  }, [code]);

  const visibleBars = bars.slice(-TF_VISIBLE[tf]);

  // ── SVG constants ─────────────────────────────────────────────────────────
  const W = 800;
  const PAD = { top: 22, right: 74, bottom: 24, left: 5 };
  const cW = W - PAD.left - PAD.right;
  const cH_main = 300 - PAD.top - PAD.bottom; // 254

  const n = visibleBars.length;
  if (n < 2) {
    // Nothing to render yet — show placeholder
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
        <ChartHeader
          stockName={stockName} symbol={symbol} lastPrice={lastPrice}
          signal={signal} tf={tf} setTf={setTf} loading={loading}
          onRefresh={() => fetchBars(tf)}
        />
        <div className="flex items-center justify-center h-48 text-slate-600 text-xs">
          {loading ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />데이터 로딩 중…</> : error ? <span className="text-rose-400">{error}</span> : '차트 데이터 없음'}
        </div>
      </div>
    );
  }

  const slotW = cW / n;
  const bodyW = Math.max(1.5, slotW * 0.65);
  const getX = (i: number) => PAD.left + (i + 0.5) * slotW;

  // Price range (main chart)
  const priceVals: number[] = [];
  visibleBars.forEach(b => {
    priceVals.push(b.high, b.low);
    if (b.ma20 != null) priceVals.push(b.ma20);
    if (b.ma60 != null) priceVals.push(b.ma60);
    if (b.ma120 != null) priceVals.push(b.ma120);
    if (position) { priceVals.push(position.avgPrice); }
  });
  if (lastPrice > 0) priceVals.push(lastPrice);
  const rawMin = Math.min(...priceVals), rawMax = Math.max(...priceVals);
  const margin = (rawMax - rawMin) * 0.06;
  const pMin = rawMin - margin, pMax = rawMax + margin;
  const getY = (v: number) => PAD.top + cH_main * (1 - (v - pMin) / (pMax - pMin));

  // Volume
  const vMax = Math.max(...visibleBars.map(b => b.volume), 1);
  const volAreaH = cH_main * 0.18;
  const getVolH = (v: number) => (v / vMax) * volAreaH;

  // X-axis labels
  const labelEvery = Math.max(1, Math.floor(n / 8));

  // Price grid
  const priceTicks = [0, 0.25, 0.5, 0.75, 1].map(r => pMin + r * (pMax - pMin));

  // MA paths
  let ma20Path = '', ma60Path = '', ma120Path = '';
  visibleBars.forEach((b, i) => {
    const x = getX(i);
    if (b.ma20 != null) { const y = getY(b.ma20); ma20Path += ma20Path ? ` L${x},${y}` : `M${x},${y}`; }
    if (b.ma60 != null) { const y = getY(b.ma60); ma60Path += ma60Path ? ` L${x},${y}` : `M${x},${y}`; }
    if (b.ma120 != null) { const y = getY(b.ma120); ma120Path += ma120Path ? ` L${x},${y}` : `M${x},${y}`; }
  });

  // Position lines
  const baseH = 300;
  const avgBuyY = position ? getY(position.avgPrice) : null;
  const slY = position ? getY(position.avgPrice * (1 - stopLossPct / 100)) : null;
  const tpY = position ? getY(position.avgPrice * (1 + takeProfitPct / 100)) : null;
  const curPriceY = lastPrice > 0 ? getY(lastPrice) : null;

  // Trade marker tolerance (half the candle interval in ms)
  const tfToleranceMs: Record<Timeframe, number> = {
    '분': 2 * 60000, '일': 30 * 3600000, '주': 8 * 86400000, '월': 35 * 86400000, '년': 370 * 86400000,
  };
  const tolerance = tfToleranceMs[tf];

  // ── MACD chart ───────────────────────────────────────────────────────────
  const MH = 100, MPAD = { top: 10, right: 74, bottom: 10, left: 5 };
  const mcH = MH - MPAD.top - MPAD.bottom;
  const macds = visibleBars.map(b => b.macd ?? 0);
  const signals2 = visibleBars.map(b => b.macdSignal ?? 0);
  const hists = visibleBars.map(b => b.macdHist ?? 0);
  const maxAbsM = Math.max(...macds.map(Math.abs), ...signals2.map(Math.abs), ...hists.map(Math.abs), 0.01);
  const getMY = (v: number) => MPAD.top + mcH / 2 - (v / maxAbsM) * (mcH / 2);
  let macdLinePath = '', sigLinePath = '';
  visibleBars.forEach((b, i) => {
    const x = getX(i);
    const mY = getMY(b.macd ?? 0), sY = getMY(b.macdSignal ?? 0);
    macdLinePath += macdLinePath ? ` L${x},${mY}` : `M${x},${mY}`;
    sigLinePath += sigLinePath ? ` L${x},${sY}` : `M${x},${sY}`;
  });
  const zeroMY = getMY(0);

  // ── RSI chart ────────────────────────────────────────────────────────────
  const RH = 80, RPAD = { top: 8, right: 74, bottom: 16, left: 5 };
  const rcH = RH - RPAD.top - RPAD.bottom;
  const getRY = (v: number) => RPAD.top + rcH * (1 - v / 100);
  let rsiPath = '';
  visibleBars.forEach((b, i) => {
    const x = getX(i), y = getRY(b.rsi ?? 50);
    rsiPath += rsiPath ? ` L${x},${y}` : `M${x},${y}`;
  });
  const lastRsi = visibleBars[n - 1]?.rsi ?? 50;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3 space-y-1.5">
      <ChartHeader
        stockName={stockName} symbol={symbol} lastPrice={lastPrice}
        signal={signal} tf={tf} setTf={setTf} loading={loading}
        onRefresh={() => fetchBars(tf)}
      />

      {error && !loading && (
        <div className="text-center py-3 text-[10px] text-rose-400 bg-rose-950/20 rounded-lg border border-rose-900/30">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-40 text-slate-600 text-xs">
          <RefreshCw className="h-4 w-4 animate-spin mr-2" /> 로딩 중…
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── Main Candlestick Chart ── */}
          <div className="relative">
            <svg viewBox={`0 0 ${W} ${baseH}`} className="w-full select-none" style={{ height: 200 }}>
              {/* Price grid */}
              {priceTicks.map((p, idx) => {
                const y = getY(p);
                if (y < PAD.top || y > baseH - PAD.bottom) return null;
                return (
                  <g key={idx}>
                    <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#1e293b" strokeWidth="1" strokeDasharray="2,5" />
                    <text x={W - PAD.right + 4} y={y + 3} fill="#475569" fontSize="8.5" fontFamily="monospace">
                      {p >= 10000 ? Math.round(p / 100) * 100 : Math.round(p)}
                    </text>
                  </g>
                );
              })}

              {/* Volume bars (background, semi-transparent) */}
              {visibleBars.map((b, i) => {
                const x = getX(i), vh = getVolH(b.volume);
                const y = baseH - PAD.bottom - vh;
                return (
                  <rect key={`v${i}`} x={x - bodyW / 2} y={y} width={bodyW} height={vh}
                    fill={b.close >= b.open ? '#10b981' : '#ef4444'} opacity="0.18" />
                );
              })}

              {/* MA lines */}
              {ma120Path && <path d={ma120Path} fill="none" stroke="#ec4899" strokeWidth="1" opacity="0.65" strokeDasharray="4,3" />}
              {ma60Path  && <path d={ma60Path}  fill="none" stroke="#38bdf8" strokeWidth="1.2" opacity="0.75" />}
              {ma20Path  && <path d={ma20Path}  fill="none" stroke="#eab308" strokeWidth="1.3" opacity="0.9" />}

              {/* Position: avg price / stop-loss / take-profit */}
              {position && avgBuyY != null && avgBuyY >= PAD.top && avgBuyY <= baseH - PAD.bottom && (
                <g>
                  <line x1={PAD.left} y1={avgBuyY} x2={W - PAD.right} y2={avgBuyY} stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4,3" />
                  <rect x={PAD.left + 4} y={avgBuyY - 9} width={86} height={17} rx="3" fill="#1d4ed8" opacity="0.92" />
                  <text x={PAD.left + 8} y={avgBuyY + 3} fill="#fff" fontSize="9" fontFamily="monospace">
                    평단 {position.avgPrice.toLocaleString()}
                  </text>
                </g>
              )}
              {position && slY != null && slY >= PAD.top && slY <= baseH - PAD.bottom && (
                <g>
                  <line x1={PAD.left} y1={slY} x2={W - PAD.right} y2={slY} stroke="#f43f5e" strokeWidth="1" strokeDasharray="2,3" />
                  <text x={W - PAD.right - 68} y={slY - 3} fill="#f43f5e" fontSize="8" fontFamily="monospace">손절 -{stopLossPct}%</text>
                </g>
              )}
              {position && tpY != null && tpY >= PAD.top && tpY <= baseH - PAD.bottom && (
                <g>
                  <line x1={PAD.left} y1={tpY} x2={W - PAD.right} y2={tpY} stroke="#10b981" strokeWidth="1" strokeDasharray="2,3" />
                  <text x={W - PAD.right - 68} y={tpY + 10} fill="#10b981" fontSize="8" fontFamily="monospace">익절 +{takeProfitPct}%</text>
                </g>
              )}

              {/* Current price */}
              {curPriceY != null && curPriceY >= PAD.top && curPriceY <= baseH - PAD.bottom && (
                <g>
                  <line x1={PAD.left} y1={curPriceY} x2={W - PAD.right} y2={curPriceY}
                    stroke="#10b981" strokeWidth="1" strokeDasharray="2,3" opacity="0.55" />
                  <rect x={W - PAD.right} y={curPriceY - 8} width={PAD.right - 1} height={16} rx="2" fill="#064e3b" />
                  <text x={W - PAD.right + 3} y={curPriceY + 4} fill="#34d399" fontSize="9" fontFamily="monospace" fontWeight="bold">
                    {lastPrice.toLocaleString()}
                  </text>
                </g>
              )}

              {/* Candlesticks */}
              {visibleBars.map((b, i) => {
                const x = getX(i);
                const isUp = b.close >= b.open;
                const color = isUp ? '#10b981' : '#ef4444';
                const yHigh = getY(b.high), yLow = getY(b.low);
                const yTop = getY(Math.max(b.open, b.close));
                const yBot = getY(Math.min(b.open, b.close));
                const bH = Math.max(1.5, yBot - yTop);
                return (
                  <g key={`c${i}`}>
                    <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth="1" opacity="0.85" />
                    <rect x={x - bodyW / 2} y={yTop} width={bodyW} height={bH}
                      fill={isUp ? color : color} fillOpacity={isUp ? 0.9 : 0.8}
                      stroke={color} strokeWidth="0.4" />
                  </g>
                );
              })}

              {/* Trade markers */}
              {tradeMarkers.map((marker, idx) => {
                const bi = visibleBars.findIndex(b => Math.abs(b.timestamp - marker.timestamp) < tolerance);
                if (bi === -1) return null;
                const x = getX(bi), y = getY(marker.price);
                const isBuy = marker.type === 'BUY';
                const color = isBuy ? '#10b981' : '#ef4444';
                const pts = isBuy
                  ? `${x},${y - 6} ${x - 5},${y + 2} ${x + 5},${y + 2}`
                  : `${x},${y + 6} ${x - 5},${y - 2} ${x + 5},${y - 2}`;
                return (
                  <g key={`t${idx}`}>
                    <polygon points={pts} fill={color} opacity="0.9" />
                    <text x={x} y={isBuy ? y - 10 : y + 16} fill={color} fontSize="8"
                      fontFamily="monospace" textAnchor="middle">{isBuy ? '매수' : '매도'}</text>
                  </g>
                );
              })}

              {/* X-axis labels */}
              {visibleBars.map((b, i) => {
                if (i % labelEvery !== 0) return null;
                return (
                  <text key={`xl${i}`} x={getX(i)} y={baseH - PAD.bottom + 13}
                    fill="#334155" fontSize="8.5" fontFamily="monospace" textAnchor="middle">
                    {b.time}
                  </text>
                );
              })}

              {/* MA legend */}
              <g>
                <rect x={PAD.left + 3} y={PAD.top + 2} width="6" height="6" fill="#eab308" rx="1" />
                <text x={PAD.left + 12} y={PAD.top + 8} fill="#eab308" fontSize="8" fontFamily="monospace">MA20</text>
                <rect x={PAD.left + 45} y={PAD.top + 2} width="6" height="6" fill="#38bdf8" rx="1" />
                <text x={PAD.left + 54} y={PAD.top + 8} fill="#38bdf8" fontSize="8" fontFamily="monospace">MA60</text>
                <rect x={PAD.left + 88} y={PAD.top + 2} width="6" height="6" fill="#ec4899" rx="1" />
                <text x={PAD.left + 97} y={PAD.top + 8} fill="#ec4899" fontSize="8" fontFamily="monospace">MA120</text>
              </g>
            </svg>
          </div>

          {/* ── MACD ── */}
          <div className="border-t border-slate-800/60 pt-1">
            <svg viewBox={`0 0 ${W} ${MH}`} className="w-full select-none" style={{ height: 64 }}>
              <line x1={PAD.left} y1={zeroMY} x2={W - MPAD.right} y2={zeroMY} stroke="#334155" strokeWidth="1" />
              {visibleBars.map((b, i) => {
                const x = getX(i), zY = getMY(0), hY = getMY(b.macdHist ?? 0);
                const h = b.macdHist ?? 0;
                return <line key={`mh${i}`} x1={x} y1={zY} x2={x} y2={hY}
                  stroke={h >= 0 ? '#10b981' : '#ef4444'} strokeWidth={Math.max(1.5, slotW * 0.55)} opacity="0.7" />;
              })}
              <path d={macdLinePath} fill="none" stroke="#22d3ee" strokeWidth="1.4" />
              <path d={sigLinePath}  fill="none" stroke="#f59e0b" strokeWidth="1.4" />
              <text x={PAD.left + 3} y={MPAD.top + 9} fill="#22d3ee" fontSize="8" fontFamily="monospace">MACD</text>
              <text x={PAD.left + 40} y={MPAD.top + 9} fill="#f59e0b" fontSize="8" fontFamily="monospace">Signal</text>
              <text x={W - MPAD.right + 3} y={MPAD.top + 9} fill="#64748b" fontSize="8" fontFamily="monospace">
                {(visibleBars[n - 1]?.macd ?? 0).toFixed(2)}
              </text>
            </svg>
          </div>

          {/* ── RSI ── */}
          <div className="border-t border-slate-800/60 pt-1">
            <svg viewBox={`0 0 ${W} ${RH}`} className="w-full select-none" style={{ height: 54 }}>
              {/* Bands */}
              <rect x={PAD.left} y={getRY(70)} width={cW} height={getRY(30) - getRY(70)} fill="#1e1b4b" opacity="0.25" />
              <line x1={PAD.left} y1={getRY(70)} x2={W - RPAD.right} y2={getRY(70)} stroke="#f43f5e" strokeWidth="0.8" strokeDasharray="3,3" opacity="0.7" />
              <line x1={PAD.left} y1={getRY(30)} x2={W - RPAD.right} y2={getRY(30)} stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3,3" opacity="0.7" />
              <text x={W - RPAD.right + 3} y={getRY(70) + 3} fill="#f43f5e" fontSize="8" fontFamily="monospace">70</text>
              <text x={W - RPAD.right + 3} y={getRY(30) + 3} fill="#38bdf8" fontSize="8" fontFamily="monospace">30</text>
              <path d={rsiPath} fill="none" stroke="#a855f7" strokeWidth="1.5" />
              <text x={PAD.left + 3} y={RPAD.top + 9} fill="#a855f7" fontSize="8" fontFamily="monospace">RSI</text>
              <text x={W - RPAD.right + 3} y={getRY(lastRsi) + 3}
                fill={lastRsi >= 70 ? '#f43f5e' : lastRsi <= 30 ? '#38bdf8' : '#a855f7'}
                fontSize="8.5" fontFamily="monospace" fontWeight="bold">
                {lastRsi.toFixed(1)}
              </text>
              {/* X-axis labels (last bar date) */}
              {visibleBars.map((b, i) => {
                if (i % labelEvery !== 0) return null;
                return (
                  <text key={`rl${i}`} x={getX(i)} y={RH - 3}
                    fill="#1e293b" fontSize="7.5" fontFamily="monospace" textAnchor="middle">
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

// ── Chart Header (extracted for reuse) ───────────────────────────────────────
function ChartHeader({
  stockName, symbol, lastPrice, signal, tf, setTf, loading, onRefresh,
}: {
  stockName: string; symbol: string; lastPrice: number;
  signal?: SignalClass; tf: Timeframe; setTf: (t: Timeframe) => void;
  loading: boolean; onRefresh: () => void;
}) {
  const sigColor: Record<string, string> = {
    '매수후보': 'bg-emerald-900/60 text-emerald-400 border-emerald-700',
    '관심': 'bg-blue-900/60 text-blue-400 border-blue-700',
    '관망': 'bg-slate-800 text-slate-400 border-slate-700',
    '위험': 'bg-rose-900/60 text-rose-400 border-rose-700',
  };
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-slate-200">{stockName || symbol}</span>
        {lastPrice > 0 && (
          <span className="text-sm font-bold font-mono text-emerald-400">{lastPrice.toLocaleString()}<span className="text-[9px] text-slate-500 ml-0.5">원</span></span>
        )}
        {signal && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${sigColor[signal] ?? sigColor['관망']}`}>
            {signal}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-0.5">
          {(['분', '일', '주', '월', '년'] as Timeframe[]).map(t => (
            <button key={t} onClick={() => setTf(t)}
              className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition ${
                tf === t ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}>{t}</button>
          ))}
        </div>
        <button onClick={onRefresh} disabled={loading}
          className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 cursor-pointer transition disabled:opacity-40">
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}
