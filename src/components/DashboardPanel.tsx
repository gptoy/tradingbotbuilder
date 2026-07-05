import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Bot, ZapOff, TrendingUp, TrendingDown, Minus, Calendar, Activity } from 'lucide-react';
import { cn } from '../lib/utils';

interface AutoState {
  active: boolean;
  serverType?: 'virtual' | 'real';
  symbol?: string;
  qty?: string;
  interval?: number;
  position?: { qty: number; avgPrice: number } | null;
}

interface TradeRecord {
  timestamp: number;
  type: 'BUY' | 'SELL';
  price: number;
  qty: number;
  symbol: string;
}

type PeriodKey = 'today' | '7d' | '30d' | 'all' | 'custom';

const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: '오늘', '7d': '7일', '30d': '30일', all: '전체', custom: '직접',
};

const STOCK_NAMES: Record<string, string> = {
  '005930': '삼성전자', '000660': 'SK하이닉스', '035420': 'NAVER',
  '035720': '카카오',   '207940': '삼성바이오',  '005380': '현대차',
  '000270': '기아',     '051910': 'LG화학',      '068270': '셀트리온',
};

const TRADING_START_KEY = 'tbbuilder:trading:start';

function readAutoState(key: string): AutoState {
  try { return { active: false, ...JSON.parse(localStorage.getItem(key) ?? '{}') }; }
  catch { return { active: false }; }
}

function readAllTrades(): TradeRecord[] {
  try {
    const raw = localStorage.getItem('tbbuilder:trades');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function filterByPeriod(trades: TradeRecord[], period: PeriodKey, customStart: string, customEnd: string): TradeRecord[] {
  const now = Date.now();
  let from = 0, to = now;
  if (period === 'today') { const d = new Date(); d.setHours(0,0,0,0); from = d.getTime(); }
  else if (period === '7d')  { from = now - 7  * 86_400_000; }
  else if (period === '30d') { from = now - 30 * 86_400_000; }
  else if (period === 'custom') {
    if (customStart) from = new Date(customStart + 'T00:00:00').getTime();
    if (customEnd)   to   = new Date(customEnd   + 'T23:59:59').getTime();
  }
  return trades.filter(t => t.timestamp >= from && t.timestamp <= to);
}

function calcPnL(trades: TradeRecord[]) {
  const buyQ: { price: number; qty: number }[] = [];
  let profit = 0, loss = 0, invested = 0, tradeCount = 0;
  for (const t of trades) {
    if (t.type === 'BUY') { buyQ.push({ price: t.price, qty: t.qty }); invested += t.price * t.qty; }
    else {
      let rem = t.qty;
      while (rem > 0 && buyQ.length > 0) {
        const b = buyQ[0], m = Math.min(rem, b.qty), pnl = (t.price - b.price) * m;
        if (pnl >= 0) profit += pnl; else loss += Math.abs(pnl);
        b.qty -= m; rem -= m; if (b.qty === 0) buyQ.shift(); tradeCount++;
      }
    }
  }
  return { profit, loss, invested, tradeCount };
}

const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtDateTime = (ts: number) =>
  new Date(ts).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const elapsed = (from: number) => {
  const d = Math.ceil((Date.now() - from) / 86_400_000);
  return d <= 1 ? '오늘' : `${d}일째`;
};

export default function DashboardPanel() {
  const [kisAuto,    setKisAuto]    = useState<AutoState>({ active: false });
  const [tossAuto,   setTossAuto]   = useState<AutoState>({ active: false });
  const [kiwoomAuto, setKiwoomAuto] = useState<AutoState>({ active: false });
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [stockName,    setStockName]    = useState('');
  const [loading,      setLoading]      = useState(false);
  const [lastUpdate,   setLastUpdate]   = useState<Date | null>(null);
  const [period,       setPeriod]       = useState<PeriodKey>('all');
  const [customStart,  setCustomStart]  = useState('');
  const [customEnd,    setCustomEnd]    = useState(new Date().toISOString().slice(0, 10));
  const [allTrades,    setAllTrades]    = useState<TradeRecord[]>([]);
  const [filteredPnL,  setFilteredPnL]  = useState({ profit: 0, loss: 0, invested: 0, tradeCount: 0 });
  const [tradingStart, setTradingStart] = useState<number | null>(null);
  const [periodStartPrice, setPeriodStartPrice] = useState<number | null>(null);
  const [kospi,   setKospi]   = useState<{ price: number; change: number } | null>(null);
  const [kosdaq,  setKosdaq]  = useState<{ price: number; change: number } | null>(null);

  const anyActive     = kisAuto.active || tossAuto.active || kiwoomAuto.active;
  const primarySymbol = (kisAuto.active && kisAuto.symbol)       ? kisAuto.symbol
                      : (tossAuto.active && tossAuto.symbol)     ? tossAuto.symbol
                      : (kiwoomAuto.active && kiwoomAuto.symbol) ? kiwoomAuto.symbol
                      : '000660';
  const displayName   = stockName || STOCK_NAMES[primarySymbol] || primarySymbol;
  const primaryPosition = kisAuto.active    ? (kisAuto.position    ?? null)
                        : tossAuto.active   ? (tossAuto.position   ?? null)
                        : kiwoomAuto.active ? (kiwoomAuto.position ?? null)
                        : null;
  const activeMode = kisAuto.active
    ? `KIS ${kisAuto.serverType === 'real' ? '실전' : '모의'}`
    : tossAuto.active ? 'Toss' : kiwoomAuto.active ? '키움' : null;

  const prevActiveRef = useRef(false);

  useEffect(() => {
    const s = localStorage.getItem(TRADING_START_KEY);
    if (s) setTradingStart(parseInt(s));
  }, []);

  useEffect(() => {
    if (anyActive && !prevActiveRef.current && !localStorage.getItem(TRADING_START_KEY)) {
      const now = Date.now();
      localStorage.setItem(TRADING_START_KEY, String(now));
      setTradingStart(now);
    }
    prevActiveRef.current = anyActive;
  }, [anyActive]);

  const readLocalState = useCallback(() => {
    const kis = readAutoState('tbbuilder:auto:kis');
    const toss = readAutoState('tbbuilder:auto:toss');
    const kiwoom = readAutoState('tbbuilder:auto:kiwoom');
    setKisAuto(kis); setTossAuto(toss); setKiwoomAuto(kiwoom);
    setAllTrades(readAllTrades());
  }, []);

  useEffect(() => {
    const sym = (kisAuto.active && kisAuto.symbol) ? kisAuto.symbol
              : (tossAuto.active && tossAuto.symbol) ? tossAuto.symbol
              : (kiwoomAuto.active && kiwoomAuto.symbol) ? kiwoomAuto.symbol : '000660';
    const symTrades = allTrades.filter(t => t.symbol === sym);
    const filtered  = filterByPeriod(symTrades, period, customStart, customEnd);
    setFilteredPnL(calcPnL(filtered));
    const firstBuy = filtered.find(t => t.type === 'BUY');
    setPeriodStartPrice(firstBuy?.price ?? null);
  }, [allTrades, period, customStart, customEnd, kisAuto, tossAuto, kiwoomAuto]);

  const fetchPrice = useCallback(async (symbol: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stock/${symbol}/price`);
      if (res.ok) {
        const p = await res.json();
        setCurrentPrice(parseInt(p.stck_prpr ?? '0'));
        setStockName(p.hts_kor_isnm ?? STOCK_NAMES[symbol] ?? symbol);
      }
      setLastUpdate(new Date());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const fetchIndices = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.allSettled([
        fetch('/api/stock/0001/price'),
        fetch('/api/stock/1001/price'),
      ]);
      const parse = async (r: PromiseSettledResult<Response>) => {
        if (r.status !== 'fulfilled' || !r.value.ok) return null;
        const d = await r.value.json();
        const price  = parseFloat(d.bstp_nmix_prpr ?? d.stck_prpr ?? '0');
        const change = parseFloat(d.bstp_nmix_prdy_vrss ?? d.prdy_vrss ?? '0');
        return price > 0 ? { price, change } : null;
      };
      const [k1, k2] = await Promise.all([parse(r1), parse(r2)]);
      if (k1) setKospi(k1);
      if (k2) setKosdaq(k2);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { readLocalState(); }, [readLocalState]);
  useEffect(() => {
    fetchPrice(primarySymbol); fetchIndices();
    const iv1 = setInterval(() => fetchPrice(primarySymbol), 30_000);
    const iv2 = setInterval(fetchIndices, 60_000);
    return () => { clearInterval(iv1); clearInterval(iv2); };
  }, [primarySymbol, fetchPrice, fetchIndices]);
  useEffect(() => {
    const fn = (e: StorageEvent) => { if (e.key?.startsWith('tbbuilder:')) readLocalState(); };
    window.addEventListener('storage', fn);
    return () => window.removeEventListener('storage', fn);
  }, [readLocalState]);
  useEffect(() => {
    const iv = setInterval(readLocalState, 5_000);
    return () => clearInterval(iv);
  }, [readLocalState]);

  const handleRefresh = () => { readLocalState(); fetchPrice(primarySymbol); fetchIndices(); };

  // ── 손익 계산
  const investedAmt   = primaryPosition ? Math.round(primaryPosition.avgPrice * primaryPosition.qty) : 0;
  const unrealizedAmt = primaryPosition && currentPrice
    ? Math.round((currentPrice - primaryPosition.avgPrice) * primaryPosition.qty) : 0;
  const unrealizedPct = primaryPosition && currentPrice
    ? (currentPrice - primaryPosition.avgPrice) / primaryPosition.avgPrice * 100 : 0;
  const netPnL        = filteredPnL.profit - filteredPnL.loss + unrealizedAmt;
  const periodRoiPct  = filteredPnL.invested > 0
    ? (filteredPnL.profit - filteredPnL.loss) / filteredPnL.invested * 100 : 0;

  const upText   = 'text-red-600';
  const downText = 'text-blue-600';
  const pnlText  = unrealizedAmt > 0 ? upText : unrealizedAmt < 0 ? downText : 'text-[#737373]';
  const pctText  = unrealizedPct > 0 ? upText : unrealizedPct < 0 ? downText : 'text-[#737373]';
  const netText  = netPnL > 0 ? upText : netPnL < 0 ? downText : 'text-[#171717]';
  const netIcon  = netPnL > 0 ? <TrendingUp className="h-5 w-5 text-red-600" />
                 : netPnL < 0 ? <TrendingDown className="h-5 w-5 text-blue-600" />
                 : <Minus className="h-5 w-5 text-[#737373]" />;
  const netIconBg = netPnL > 0 ? 'bg-red-50' : netPnL < 0 ? 'bg-blue-50' : 'bg-[#f5f5f5]';

  // 기간 내 필터된 거래 목록
  const sym = (kisAuto.active && kisAuto.symbol) ? kisAuto.symbol
            : (tossAuto.active && tossAuto.symbol) ? tossAuto.symbol
            : (kiwoomAuto.active && kiwoomAuto.symbol) ? kiwoomAuto.symbol : '000660';
  const filteredTrades = filterByPeriod(allTrades.filter(t => t.symbol === sym), period, customStart, customEnd);

  return (
    <div className="space-y-3 p-3">

      {/* ── 헤더 ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {anyActive ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2563eb] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2563eb]" />
              </span>
              <span className="text-xs font-semibold text-[#171717]">{activeMode}</span>
              <span className="text-[#d4d4d4]">·</span>
              <span className="text-xs font-mono text-[#737373]">{primarySymbol}</span>
              <span className="text-xs text-[#737373]">{displayName}</span>
            </>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-[#737373]">
              <ZapOff className="h-3.5 w-3.5" />
              자동매매 비활성
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-[10px] font-mono text-[#a3a3a3]">
              {lastUpdate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-1.5 rounded-lg text-[#a3a3a3] hover:text-[#171717] hover:bg-[#f5f5f5] transition cursor-pointer"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* ── 거래 시작일 태그 ───────────────────────────────────────────────── */}
      {tradingStart && (
        <div className="flex items-center justify-between px-3 py-2 bg-[#f5f5f5] rounded-lg">
          <span className="flex items-center gap-1.5 text-[11px] text-[#737373]">
            <Calendar className="h-3 w-3 text-[#2563eb]" />
            <span className="font-mono">{fmtDate(tradingStart)}</span>
            <span>시작 ·</span>
            <span className="font-semibold text-[#171717]">{elapsed(tradingStart)}</span>
          </span>
          <button
            onClick={() => {
              const now = Date.now();
              localStorage.setItem(TRADING_START_KEY, String(now));
              setTradingStart(now);
            }}
            className="text-[10px] text-[#a3a3a3] hover:text-[#525252] transition cursor-pointer"
          >
            초기화
          </button>
        </div>
      )}

      {/* ── 히어로: 순손익 + 기간 필터 ────────────────────────────────────── */}
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5">
        {/* 메인 수치 */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[#a3a3a3] mb-2">
              순손익 합계
            </p>
            <p className={cn('text-[2.6rem] leading-none font-black font-mono tracking-tight', netText)}>
              {netPnL >= 0 ? '+' : ''}{fmt(netPnL)}
              <span className="text-lg font-normal text-[#a3a3a3] ml-2">원</span>
            </p>
            {filteredPnL.invested > 0 && (
              <p className={cn('text-lg font-bold font-mono mt-2', periodRoiPct > 0 ? upText : periodRoiPct < 0 ? downText : 'text-[#737373]')}>
                {periodRoiPct >= 0 ? '+' : ''}{periodRoiPct.toFixed(2)}%
                <span className="text-xs font-normal text-[#a3a3a3] ml-2">수익률</span>
              </p>
            )}
          </div>
          <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', netIconBg)}>
            {netIcon}
          </div>
        </div>

        {/* 기간 필터 탭 */}
        <div className="flex gap-1.5">
          {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map(k => (
            <button
              key={k}
              onClick={() => setPeriod(k)}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer border',
                period === k
                  ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                  : 'text-[#737373] border-[#e5e5e5] hover:border-[#d4d4d4] hover:text-[#171717]'
              )}
            >
              {PERIOD_LABELS[k]}
            </button>
          ))}
        </div>

        {/* 직접 입력 날짜 */}
        {period === 'custom' && (
          <div className="flex items-center gap-2 mt-2.5">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="flex-1 text-[11px] font-mono bg-white border border-[#171717] rounded-[6px] px-2 py-1.5 text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#2563eb]" />
            <span className="text-[11px] text-[#a3a3a3]">–</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="flex-1 text-[11px] font-mono bg-white border border-[#171717] rounded-[6px] px-2 py-1.5 text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#2563eb]" />
          </div>
        )}
      </div>

      {/* ── 4 KPI 그리드 ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5">

        {/* 투자금액 */}
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-4">
          <p className="text-[9px] font-semibold tracking-[0.12em] uppercase text-[#a3a3a3] mb-2">투자금액</p>
          <p className="text-xl font-black font-mono text-[#171717] tracking-tight leading-none">
            {primaryPosition ? fmt(investedAmt) : <span className="text-[#d4d4d4]">—</span>}
          </p>
          {primaryPosition && (
            <>
              <p className="text-[9px] font-normal text-[#a3a3a3] mt-0.5">원</p>
              <p className="text-[10px] text-[#737373] mt-2 font-mono leading-relaxed">
                {primaryPosition.qty}주<br />
                <span className="text-[#a3a3a3]">평단</span> {fmt(primaryPosition.avgPrice)}
              </p>
            </>
          )}
        </div>

        {/* 평가손익 */}
        <div className={cn(
          'rounded-xl p-4 border',
          unrealizedAmt > 0 ? 'bg-red-50 border-red-100' :
          unrealizedAmt < 0 ? 'bg-blue-50 border-blue-100' :
          'bg-white border-[#e5e5e5]'
        )}>
          <p className="text-[9px] font-semibold tracking-[0.12em] uppercase text-[#a3a3a3] mb-2">평가손익</p>
          {primaryPosition && currentPrice ? (
            <>
              <p className={cn('text-xl font-black font-mono tracking-tight leading-none', pnlText)}>
                {unrealizedAmt >= 0 ? '+' : ''}{fmt(unrealizedAmt)}
              </p>
              <p className={cn('text-[9px] mt-0.5', unrealizedAmt > 0 ? 'text-red-400' : unrealizedAmt < 0 ? 'text-blue-400' : 'text-[#a3a3a3]')}>원</p>
              <p className={cn('text-[10px] font-mono font-bold mt-2', pctText)}>
                {unrealizedPct >= 0 ? '+' : ''}{unrealizedPct.toFixed(2)}%
              </p>
              <p className="text-[10px] text-[#a3a3a3] font-mono">{fmt(currentPrice)}원</p>
            </>
          ) : (
            <p className="text-xl font-black font-mono text-[#d4d4d4] leading-none">—</p>
          )}
        </div>

        {/* 실현 수익 */}
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <div className="flex items-center gap-1 mb-2">
            <TrendingUp className="h-3 w-3 text-red-400" />
            <p className="text-[9px] font-semibold tracking-[0.12em] uppercase text-red-400">실현 수익</p>
          </div>
          <p className="text-xl font-black font-mono text-red-600 tracking-tight leading-none">
            +{fmt(filteredPnL.profit)}
          </p>
          <p className="text-[9px] text-red-300 mt-0.5">원</p>
          <p className="text-[10px] text-red-400 mt-2">
            {filteredPnL.tradeCount > 0 ? `${filteredPnL.tradeCount}건 완결` : '거래 없음'}
          </p>
        </div>

        {/* 실현 손실 */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-center gap-1 mb-2">
            <TrendingDown className="h-3 w-3 text-blue-400" />
            <p className="text-[9px] font-semibold tracking-[0.12em] uppercase text-blue-400">실현 손실</p>
          </div>
          <p className="text-xl font-black font-mono text-blue-600 tracking-tight leading-none">
            -{fmt(filteredPnL.loss)}
          </p>
          <p className="text-[9px] text-blue-300 mt-0.5">원</p>
          <p className="text-[10px] text-blue-400 mt-2">기간 누적</p>
        </div>
      </div>

      {/* ── 시황 스트립: 종목 + KOSPI + KOSDAQ ──────────────────────────── */}
      <div className="bg-white border border-[#e5e5e5] rounded-xl px-4 py-3">
        <div className="flex items-center gap-1.5 mb-3">
          <Activity className="h-3 w-3 text-[#a3a3a3]" />
          <span className="text-[9px] font-semibold tracking-[0.12em] uppercase text-[#a3a3a3]">시황</span>
          <span className="text-[9px] text-[#d4d4d4]">· 실시간</span>
        </div>
        <div className="flex items-center gap-4">

          {/* 종목 */}
          <div className="flex-1">
            <p className="text-[9px] text-[#a3a3a3] mb-0.5">{displayName}</p>
            <p className="text-sm font-black font-mono text-[#171717]">
              {currentPrice ? fmt(currentPrice) : '—'}
            </p>
            {periodStartPrice && periodStartPrice !== currentPrice && (
              <p className="text-[9px] text-[#a3a3a3] font-mono">첫체결 {fmt(periodStartPrice)}</p>
            )}
          </div>

          <div className="w-px h-8 bg-[#f0f0f0]" />

          {/* KOSPI */}
          <div className="flex-1">
            <p className="text-[9px] text-[#a3a3a3] mb-0.5">KOSPI</p>
            {kospi ? (
              <>
                <p className="text-sm font-black font-mono text-[#171717]">
                  {kospi.price.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
                </p>
                <p className={cn('text-[9px] font-mono', kospi.change >= 0 ? 'text-red-500' : 'text-blue-500')}>
                  {kospi.change >= 0 ? '+' : ''}{kospi.change.toFixed(2)}
                </p>
              </>
            ) : (
              <p className="text-sm font-mono text-[#d4d4d4]">—</p>
            )}
          </div>

          <div className="w-px h-8 bg-[#f0f0f0]" />

          {/* KOSDAQ */}
          <div className="flex-1">
            <p className="text-[9px] text-[#a3a3a3] mb-0.5">KOSDAQ</p>
            {kosdaq ? (
              <>
                <p className="text-sm font-black font-mono text-[#171717]">
                  {kosdaq.price.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
                </p>
                <p className={cn('text-[9px] font-mono', kosdaq.change >= 0 ? 'text-red-500' : 'text-blue-500')}>
                  {kosdaq.change >= 0 ? '+' : ''}{kosdaq.change.toFixed(2)}
                </p>
              </>
            ) : (
              <p className="text-sm font-mono text-[#d4d4d4]">—</p>
            )}
          </div>
        </div>
      </div>

      {/* ── 거래 내역 타임라인 ─────────────────────────────────────────────── */}
      {filteredTrades.length > 0 && (
        <div className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#f5f5f5]">
            <span className="text-[9px] font-semibold tracking-[0.12em] uppercase text-[#a3a3a3]">거래 내역</span>
            <span className="text-[9px] font-mono text-[#a3a3a3]">{filteredTrades.length}건</span>
          </div>
          <div className="divide-y divide-[#f7f7f7] max-h-[220px] overflow-y-auto">
            {filteredTrades.slice().reverse().map((t, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#fafafa] transition">
                <div className={cn('h-1.5 w-1.5 rounded-full shrink-0 mt-0.5',
                  t.type === 'BUY' ? 'bg-red-400' : 'bg-blue-400'
                )} />
                <div className="flex-1 min-w-0">
                  <span className={cn('text-[10px] font-bold',
                    t.type === 'BUY' ? 'text-red-600' : 'text-blue-600'
                  )}>
                    {t.type === 'BUY' ? '매수' : '매도'}
                  </span>
                  <span className="text-[10px] text-[#a3a3a3] ml-2">{fmtDateTime(t.timestamp)}</span>
                </div>
                <span className="text-[10px] font-mono font-semibold text-[#171717] shrink-0">
                  {fmt(t.price)}<span className="text-[#a3a3a3] font-normal">원</span>
                  <span className="text-[#d4d4d4] mx-1">×</span>
                  {t.qty}주
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 비활성 안내 ────────────────────────────────────────────────────── */}
      {!anyActive && (
        <div className="flex flex-col items-center gap-4 py-10">
          <div className="h-14 w-14 rounded-2xl bg-[#f5f5f5] flex items-center justify-center">
            <Bot className="h-6 w-6 text-[#a3a3a3]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[#171717]">자동매매 미연결</p>
            <p className="text-xs text-[#a3a3a3] mt-1">KIS 탭에서 연결 후 자동매매를 시작하세요</p>
          </div>
        </div>
      )}

    </div>
  );
}
