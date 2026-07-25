import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Bot, TrendingUp, TrendingDown, Minus,
  Activity, Wallet, BarChart2, CircleDot, ChevronUp, ChevronDown,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface KisBalanceSummary {
  dnca_tot_amt: string;
  ord_psbl_cash: string;
  scts_evlu_amt: string;
  tot_evlu_amt: string;
  thdt_buy_amt: string;
  evlu_pfls_smtl_amt: string;
}

interface KisHolding {
  pdno: string;
  prdt_name: string;
  hldg_qty: string;
  pchs_avg_pric: string;
  prpr: string;
  evlu_pfls_amt: string;
  evlu_pfls_rt: string;
}

interface AutoState {
  active: boolean;
  serverType?: 'virtual' | 'real';
  symbols?: string[];
  qty?: string;
  interval?: number;
  positions?: Record<string, { qty: number; avgPrice: number } | null>;
}

interface TradeRecord {
  timestamp: number;
  type: 'BUY' | 'SELL';
  price: number;
  qty: number;
  symbol: string;
}

type PeriodKey = 'today' | '7d' | '30d' | 'all';
const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: '오늘', '7d': '7일', '30d': '30일', all: '전체',
};

// ── Constants ─────────────────────────────────────────────────────────────────

const STOCK_NAMES: Record<string, string> = {
  '005930': '삼성전자',   '000660': 'SK하이닉스', '207940': '삼성바이오',
  '005380': '현대차',     '035420': 'NAVER',      '000270': '기아',
  '051910': 'LG화학',     '068270': '셀트리온',   '105560': 'KB금융',
  '055550': '신한지주',   '035720': '카카오',     '003550': 'LG',
  '034730': 'SK',         '028260': '삼성물산',   '012330': '현대모비스',
  '066570': 'LG전자',     '032830': '삼성생명',   '086790': '하나금융',
  '316140': '우리금융',   '096770': 'SK이노베이션',
};

const TRADING_START_KEY = 'tbbuilder:trading:start';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
const fmtCompact = (n: number) => {
  if (Math.abs(n) >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (Math.abs(n) >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return fmt(n);
};
const fmtTime = (ts: number) =>
  new Date(ts).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmtDateShort = (ts: number) =>
  new Date(ts).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
const elapsed = (from: number) => {
  const d = Math.ceil((Date.now() - from) / 86_400_000);
  return d <= 1 ? '오늘' : `D+${d - 1}`;
};

function readAutoState(key: string): AutoState {
  try { return { active: false, ...JSON.parse(localStorage.getItem(key) ?? '{}') }; }
  catch { return { active: false }; }
}

function readAllTrades(): TradeRecord[] {
  try { return JSON.parse(localStorage.getItem('tbbuilder:trades') ?? '[]'); }
  catch { return []; }
}

function filterByPeriod(trades: TradeRecord[], period: PeriodKey): TradeRecord[] {
  const now = Date.now();
  let from = 0;
  if (period === 'today')  { const d = new Date(); d.setHours(0,0,0,0); from = d.getTime(); }
  else if (period === '7d')  { from = now - 7  * 86_400_000; }
  else if (period === '30d') { from = now - 30 * 86_400_000; }
  return trades.filter(t => t.timestamp >= from);
}

function calcPnL(trades: TradeRecord[]) {
  const buyQ: Record<string, { price: number; qty: number }[]> = {};
  let profit = 0, loss = 0, invested = 0, tradeCount = 0;
  for (const t of trades) {
    if (!buyQ[t.symbol]) buyQ[t.symbol] = [];
    if (t.type === 'BUY') {
      buyQ[t.symbol].push({ price: t.price, qty: t.qty });
      invested += t.price * t.qty;
    } else {
      let rem = t.qty;
      while (rem > 0 && buyQ[t.symbol]?.length > 0) {
        const b = buyQ[t.symbol][0];
        const m = Math.min(rem, b.qty);
        const pnl = (t.price - b.price) * m;
        if (pnl >= 0) profit += pnl; else loss += Math.abs(pnl);
        b.qty -= m; rem -= m;
        if (b.qty === 0) buyQ[t.symbol].shift();
        tradeCount++;
      }
    }
  }
  return { profit, loss, invested, tradeCount };
}

function mergePositions(kis: AutoState, toss: AutoState) {
  const out: { symbol: string; qty: number; avgPrice: number; broker: 'KIS' | 'Toss' }[] = [];
  const seen = new Set<string>();
  for (const [sym, pos] of Object.entries(kis.positions ?? {})) {
    if (pos && pos.qty > 0) { out.push({ symbol: sym, ...pos, broker: 'KIS' }); seen.add(sym); }
  }
  for (const [sym, pos] of Object.entries(toss.positions ?? {})) {
    if (pos && pos.qty > 0 && !seen.has(sym)) out.push({ symbol: sym, ...pos, broker: 'Toss' });
  }
  return out;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, right }: {
  icon: React.ReactNode; title: string; right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e3a58]">
      <div className="flex items-center gap-1.5">
        <span className="text-[#1d6ef8]">{icon}</span>
        <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#9ec4de]">{title}</span>
      </div>
      {right && <div className="text-[10px] text-[#80acd0]">{right}</div>}
    </div>
  );
}

function PnLBadge({ value, className }: { value: number; className?: string }) {
  const up = value > 0, dn = value < 0;
  return (
    <span className={cn(
      'font-mono font-bold tabular-nums',
      up ? 'text-red-400' : dn ? 'text-blue-400' : 'text-[#80acd0]',
      className,
    )}>
      {up ? '+' : ''}{fmt(value)}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DashboardPanel() {
  const [kisAuto,    setKisAuto]    = useState<AutoState>({ active: false });
  const [tossAuto,   setTossAuto]   = useState<AutoState>({ active: false });
  const [kiwoomAuto, setKiwoomAuto] = useState<AutoState>({ active: false });

  const [allTrades,   setAllTrades]   = useState<TradeRecord[]>([]);
  const [period,      setPeriod]      = useState<PeriodKey>('all');
  const [filteredPnL, setFilteredPnL] = useState({ profit: 0, loss: 0, invested: 0, tradeCount: 0 });

  const [kisBalance,        setKisBalance]        = useState<KisBalanceSummary | null>(null);
  const [kisHoldings,       setKisHoldings]       = useState<KisHolding[]>([]);
  const [kisBalanceLoading, setKisBalanceLoading] = useState(false);

  const [heldPrices,    setHeldPrices]    = useState<Record<string, number>>({});
  const [pricesLoading, setPricesLoading] = useState(false);

  const [tradingStart, setTradingStart] = useState<number | null>(null);
  const [refreshing,   setRefreshing]   = useState(false);
  const [lastUpdate,   setLastUpdate]   = useState<Date | null>(null);

  const anyActive = kisAuto.active || tossAuto.active || kiwoomAuto.active;

  // ── Data fetchers ─────────────────────────────────────────────────────────

  const readLocalState = useCallback(() => {
    setKisAuto(readAutoState('tbbuilder:auto:kis'));
    setTossAuto(readAutoState('tbbuilder:auto:toss'));
    setKiwoomAuto(readAutoState('tbbuilder:auto:kiwoom'));
    setAllTrades(readAllTrades());
  }, []);

  const fetchHeldPrices = useCallback(async (positions: ReturnType<typeof mergePositions>) => {
    if (positions.length === 0) return;
    setPricesLoading(true);
    const results: Record<string, number> = {};
    await Promise.allSettled(positions.map(async ({ symbol }) => {
      try {
        const r = await fetch(`/api/stock/${symbol}/price`);
        if (r.ok) { const d = await r.json(); const p = parseInt(d.stck_prpr ?? '0'); if (p > 0) results[symbol] = p; }
      } catch { /* ignore */ }
    }));
    setHeldPrices(prev => ({ ...prev, ...results }));
    setPricesLoading(false);
    setLastUpdate(new Date());
  }, []);

  const fetchKisBalance = useCallback(async () => {
    try {
      const session = JSON.parse(localStorage.getItem('tbbuilder:kis:live-session') ?? '{}');
      const creds   = JSON.parse(localStorage.getItem('tbbuilder:kis:virtual') ?? '{}');
      const auto    = JSON.parse(localStorage.getItem('tbbuilder:auto:kis') ?? '{}');
      const { token } = session;
      const { accountNo, appKey, appSecret } = creds;
      if (!token || !accountNo || !appKey) return;
      const cano = accountNo.slice(0, 8), acntPrdtCd = accountNo.length > 8 ? accountNo.slice(8) : '01';
      setKisBalanceLoading(true);
      const res = await fetch(
        `/api/kis/balance?cano=${encodeURIComponent(cano)}&acntPrdtCd=${encodeURIComponent(acntPrdtCd)}`,
        { headers: { 'x-kis-token': token, 'x-kis-appkey': appKey, 'x-kis-appsecret': appSecret, 'x-kis-server': auto.serverType ?? 'virtual' } },
      );
      const data = await res.json();
      if (data.output2) { setKisBalance((data.output2?.[0] ?? data.output2) as KisBalanceSummary); setKisHoldings((data.output1 ?? []) as KisHolding[]); }
    } catch { /* ignore */ }
    setKisBalanceLoading(false);
  }, []);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const s = localStorage.getItem(TRADING_START_KEY);
    if (s) setTradingStart(parseInt(s));
  }, []);

  useEffect(() => {
    if (anyActive && !localStorage.getItem(TRADING_START_KEY)) {
      const now = Date.now();
      localStorage.setItem(TRADING_START_KEY, String(now));
      setTradingStart(now);
    }
  }, [anyActive]);

  useEffect(() => { readLocalState(); }, [readLocalState]);
  useEffect(() => {
    const fn = (e: StorageEvent) => { if (e.key?.startsWith('tbbuilder:')) readLocalState(); };
    window.addEventListener('storage', fn);
    return () => window.removeEventListener('storage', fn);
  }, [readLocalState]);
  useEffect(() => { const iv = setInterval(readLocalState, 5_000); return () => clearInterval(iv); }, [readLocalState]);

  useEffect(() => {
    const filtered = filterByPeriod(allTrades, period);
    setFilteredPnL(calcPnL(filtered));
  }, [allTrades, period]);

  useEffect(() => {
    const positions = mergePositions(kisAuto, tossAuto);
    fetchHeldPrices(positions);
    const iv = setInterval(() => fetchHeldPrices(positions), 30_000);
    return () => clearInterval(iv);
  }, [kisAuto, tossAuto, fetchHeldPrices]);

  useEffect(() => {
    fetchKisBalance();
    const iv = setInterval(fetchKisBalance, 60_000);
    return () => clearInterval(iv);
  }, [fetchKisBalance]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const positions     = mergePositions(kisAuto, tossAuto);
  const filteredTrades = filterByPeriod(allTrades, period).slice().reverse();

  const unrealizedAmt = positions.reduce((acc, p) => {
    const cur = heldPrices[p.symbol]; return cur ? acc + (cur - p.avgPrice) * p.qty : acc;
  }, 0);
  const totalInvested = positions.reduce((acc, p) => acc + p.avgPrice * p.qty, 0);
  const realizedNet   = filteredPnL.profit - filteredPnL.loss;
  const netPnL        = realizedNet + unrealizedAmt;
  const periodRoiPct  = filteredPnL.invested > 0 ? realizedNet / filteredPnL.invested * 100 : 0;

  const kisHeldCount  = Object.values(kisAuto.positions  ?? {}).filter(Boolean).length;
  const tossHeldCount = Object.values(tossAuto.positions ?? {}).filter(Boolean).length;

  const handleRefresh = async () => {
    setRefreshing(true);
    readLocalState();
    await Promise.allSettled([fetchKisBalance(), fetchHeldPrices(positions)]);
    setLastUpdate(new Date());
    setRefreshing(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">

      {/* ════════════════════ LEFT SIDEBAR ════════════════════════════════ */}
      <div className="xl:col-span-4 space-y-3">

        {/* ── 자동매매 상태 ──────────────────────────────────────────────── */}
        <div className="bg-[#152e48] border border-[#1e3a58] rounded-lg overflow-hidden">
          <SectionHeader
            icon={<CircleDot className="h-3.5 w-3.5" />}
            title="자동매매 현황"
            right={lastUpdate ? lastUpdate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : undefined}
          />
          <div className="divide-y divide-[#162e46]">
            {([
              { label: 'KIS', state: kisAuto,  serverLabel: kisAuto.serverType === 'real' ? '실전' : '모의', held: kisHeldCount },
              { label: 'Toss', state: tossAuto, serverLabel: '실전', held: tossHeldCount },
              { label: '키움', state: kiwoomAuto, serverLabel: '실전', held: 0 },
            ] as const).map(({ label, state, serverLabel, held }) => (
              <div key={label} className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  {state.active ? (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                    </span>
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#264562]" />
                  )}
                  <span className={cn('text-[12px] font-semibold', state.active ? 'text-[#ecf5ff]' : 'text-[#608ab0]')}>
                    {label}
                  </span>
                  {state.active && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-[#1d6ef8]/15 text-[#1d6ef8] font-medium">
                      {serverLabel}
                    </span>
                  )}
                </div>
                {state.active ? (
                  <div className="text-right">
                    <div className="text-[11px] text-[#ecf5ff] font-mono">{held > 0 ? `${held}종목 보유` : '포지션 없음'}</div>
                    <div className="text-[9px] text-[#80acd0]">TOP20 감시 · {state.interval ?? 30}s</div>
                  </div>
                ) : (
                  <span className="text-[10px] text-[#608ab0]">비활성</span>
                )}
              </div>
            ))}
          </div>
          <div className="px-3 pb-2.5 pt-1 flex items-center justify-between border-t border-[#162e46]">
            {tradingStart && (
              <span className="text-[9px] text-[#80acd0]">
                시작: {fmtDateShort(tradingStart)} <span className="text-[#1d6ef8] font-semibold">{elapsed(tradingStart)}</span>
              </span>
            )}
            <button onClick={handleRefresh} disabled={refreshing}
              className="ml-auto text-[#80acd0] hover:text-[#ecf5ff] transition cursor-pointer">
              <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ── KIS 계좌 잔고 ──────────────────────────────────────────────── */}
        <div className="bg-[#152e48] border border-[#1e3a58] rounded-lg overflow-hidden">
          <SectionHeader
            icon={<Wallet className="h-3.5 w-3.5" />}
            title={`KIS ${kisAuto.serverType === 'real' ? '실전' : '모의'} 계좌`}
            right={
              <button onClick={fetchKisBalance} disabled={kisBalanceLoading}
                className="text-[#80acd0] hover:text-[#ecf5ff] transition cursor-pointer">
                <RefreshCw className={cn('h-2.5 w-2.5', kisBalanceLoading && 'animate-spin')} />
              </button>
            }
          />
          {kisBalance ? (
            <>
              {/* 총평가금액 히어로 */}
              <div className="px-3 py-3 border-b border-[#162e46]">
                <div className="text-[9px] text-[#80acd0] mb-0.5">총평가금액</div>
                <div className="text-[20px] font-black font-mono tabular-nums text-[#ecf5ff] leading-none">
                  {fmtCompact(parseInt(kisBalance.tot_evlu_amt ?? '0'))}
                  <span className="text-[11px] font-normal text-[#80acd0] ml-1">원</span>
                </div>
                {(() => {
                  const pnl = parseInt(kisBalance.evlu_pfls_smtl_amt ?? '0');
                  return pnl !== 0 ? (
                    <div className={cn('text-[11px] font-mono mt-1', pnl > 0 ? 'text-red-400' : 'text-blue-400')}>
                      {pnl > 0 ? '+' : ''}{fmt(pnl)}원 평가손익
                    </div>
                  ) : null;
                })()}
              </div>
              {/* 세부 수치 그리드 */}
              <div className="grid grid-cols-2 divide-x divide-[#162e46] divide-y-0 border-b border-[#162e46]">
                {([
                  ['예수금',   parseInt(kisBalance.dnca_tot_amt  ?? '0')],
                  ['주문가능', parseInt(kisBalance.ord_psbl_cash ?? '0')],
                  ['유가평가', parseInt(kisBalance.scts_evlu_amt ?? '0')],
                  ['금일매수', parseInt(kisBalance.thdt_buy_amt  ?? '0')],
                ] as [string, number][]).map(([label, val]) => (
                  <div key={label} className="px-3 py-2">
                    <div className="text-[9px] text-[#80acd0]">{label}</div>
                    <div className="text-[11px] font-bold font-mono tabular-nums text-[#ecf5ff]">{fmt(val)}</div>
                  </div>
                ))}
              </div>
              {/* KIS 보유종목 */}
              {kisHoldings.filter(h => parseInt(h.hldg_qty) > 0).length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[9px] font-semibold text-[#80acd0] uppercase tracking-wide border-b border-[#162e46]">
                    보유종목
                  </div>
                  <div className="divide-y divide-[#162e46]">
                    {kisHoldings.filter(h => parseInt(h.hldg_qty) > 0).map((h, i) => {
                      const pnl = parseInt(h.evlu_pfls_amt ?? '0');
                      const rt  = parseFloat(h.evlu_pfls_rt ?? '0');
                      return (
                        <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-[#11243c] transition">
                          <div>
                            <div className="text-[11px] font-semibold text-[#ecf5ff]">{h.prdt_name}</div>
                            <div className="text-[9px] text-[#80acd0] font-mono">
                              {parseInt(h.hldg_qty)}주 · {fmt(parseFloat(h.pchs_avg_pric))}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] font-mono font-bold text-[#ecf5ff]">{fmt(parseInt(h.prpr))}</div>
                            <div className={cn('text-[9px] font-mono', pnl >= 0 ? 'text-red-400' : 'text-blue-400')}>
                              {pnl >= 0 ? '+' : ''}{pnl.toLocaleString()} ({rt >= 0 ? '+' : ''}{rt.toFixed(2)}%)
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-8 text-[11px] text-[#608ab0]">
              계좌 연결 필요
            </div>
          )}
        </div>

        {/* ── 보유 포지션 (자동매매 기준) ────────────────────────────────── */}
        {positions.length > 0 && (
          <div className="bg-[#152e48] border border-[#1e3a58] rounded-lg overflow-hidden">
            <SectionHeader
              icon={<BarChart2 className="h-3.5 w-3.5" />}
              title="자동매매 포지션"
              right={`${positions.length}종목`}
            />
            <div className="divide-y divide-[#162e46]">
              {positions.map(p => {
                const cur    = heldPrices[p.symbol];
                const pnl    = cur ? (cur - p.avgPrice) * p.qty : null;
                const pnlPct = cur ? (cur - p.avgPrice) / p.avgPrice * 100 : null;
                const isGain = pnl !== null && pnl >= 0;
                return (
                  <div key={`${p.broker}-${p.symbol}`}
                    className="flex items-center justify-between px-3 py-2 hover:bg-[#11243c] transition">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-[#ecf5ff]">
                          {STOCK_NAMES[p.symbol] ?? p.symbol}
                        </span>
                        <span className="text-[8px] px-1 rounded bg-[#1e3a58] text-[#80acd0]">{p.broker}</span>
                      </div>
                      <div className="text-[9px] text-[#80acd0] font-mono">
                        {p.qty}주 · 평단 {fmt(p.avgPrice)}
                      </div>
                    </div>
                    <div className="text-right">
                      {cur ? (
                        <>
                          <div className="text-[11px] font-mono font-bold text-[#ecf5ff]">{fmt(cur)}</div>
                          <div className={cn('text-[9px] font-mono', isGain ? 'text-red-400' : 'text-blue-400')}>
                            {pnl! >= 0 ? '+' : ''}{fmt(pnl!)} ({pnlPct! >= 0 ? '+' : ''}{pnlPct!.toFixed(2)}%)
                          </div>
                        </>
                      ) : (
                        <span className="text-[9px] text-[#608ab0]">{pricesLoading ? '조회중' : '—'}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 비활성 안내 ────────────────────────────────────────────────── */}
        {!anyActive && (
          <div className="bg-[#152e48] border border-[#1e3a58] rounded-lg flex flex-col items-center gap-3 py-10">
            <div className="h-12 w-12 rounded-xl bg-[#11243c] border border-[#1e3a58] flex items-center justify-center">
              <Bot className="h-5 w-5 text-[#608ab0]" />
            </div>
            <div className="text-center">
              <p className="text-[12px] font-semibold text-[#80acd0]">자동매매 미연결</p>
              <p className="text-[10px] text-[#608ab0] mt-1">자동매매 탭에서 KIS 또는 Toss를 연결하세요</p>
            </div>
          </div>
        )}

      </div>{/* end LEFT SIDEBAR */}

      {/* ════════════════════ RIGHT MAIN ══════════════════════════════════ */}
      <div className="xl:col-span-8 space-y-3">

        {/* ── 손익 히어로 카드 ────────────────────────────────────────────── */}
        <div className="bg-[#152e48] border border-[#1e3a58] rounded-lg overflow-hidden">
          <div className="flex items-stretch divide-x divide-[#1e3a58]">

            {/* 순손익 메인 */}
            <div className="flex-1 p-4">
              <div className="text-[9px] font-semibold tracking-[0.1em] uppercase text-[#80acd0] mb-2">
                순손익 합계
              </div>
              <div className={cn(
                'text-[2.2rem] font-black font-mono tabular-nums leading-none',
                netPnL > 0 ? 'text-red-400' : netPnL < 0 ? 'text-blue-400' : 'text-[#ecf5ff]',
              )}>
                {netPnL >= 0 ? '+' : ''}{fmt(netPnL)}
                <span className="text-[14px] font-normal text-[#80acd0] ml-1.5">원</span>
              </div>
              {filteredPnL.invested > 0 && (
                <div className={cn(
                  'text-[13px] font-bold font-mono mt-1.5',
                  periodRoiPct > 0 ? 'text-red-400' : periodRoiPct < 0 ? 'text-blue-400' : 'text-[#80acd0]',
                )}>
                  {periodRoiPct >= 0 ? '+' : ''}{periodRoiPct.toFixed(2)}%
                  <span className="text-[9px] font-normal text-[#80acd0] ml-1.5">수익률</span>
                </div>
              )}

              {/* 기간 탭 */}
              <div className="flex gap-1 mt-4">
                {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map(k => (
                  <button
                    key={k}
                    onClick={() => setPeriod(k)}
                    className={cn(
                      'px-2.5 py-1 rounded text-[10px] font-semibold transition cursor-pointer',
                      period === k
                        ? 'bg-[#1d6ef8] text-white'
                        : 'text-[#80acd0] hover:text-[#ecf5ff] hover:bg-[#1e3a58]',
                    )}
                  >
                    {PERIOD_LABELS[k]}
                  </button>
                ))}
              </div>
            </div>

            {/* 우측 KPI 세로 블록 */}
            <div className="flex flex-col divide-y divide-[#1e3a58] min-w-[160px]">
              {([
                {
                  label: '평가손익',
                  value: unrealizedAmt,
                  sub: `${positions.length > 0 ? positions.length + '종목' : '—'}`,
                  colored: true,
                },
                {
                  label: '실현수익',
                  value: filteredPnL.profit,
                  sub: `${filteredPnL.tradeCount}건 완결`,
                  colored: false,
                  forceRed: true,
                },
                {
                  label: '실현손실',
                  value: -filteredPnL.loss,
                  sub: '기간 누적',
                  colored: false,
                  forceBlue: true,
                },
                {
                  label: '투자원금',
                  value: totalInvested,
                  sub: '현재 보유 기준',
                  colored: false,
                },
              ]).map(({ label, value, sub, colored, forceRed, forceBlue }) => {
                const cls = colored
                  ? value > 0 ? 'text-red-400' : value < 0 ? 'text-blue-400' : 'text-[#ecf5ff]'
                  : forceRed ? 'text-red-400'
                  : forceBlue ? 'text-blue-400'
                  : 'text-[#ecf5ff]';
                return (
                  <div key={label} className="flex-1 flex flex-col justify-center px-3 py-2">
                    <div className="text-[9px] text-[#80acd0] mb-0.5">{label}</div>
                    <div className={cn('text-[13px] font-bold font-mono tabular-nums', cls)}>
                      {forceRed || (colored && value > 0) ? '+' : ''}{fmt(Math.abs(value))}
                    </div>
                    <div className="text-[9px] text-[#608ab0]">{sub}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── 거래 내역 ──────────────────────────────────────────────────── */}
        <div className="bg-[#152e48] border border-[#1e3a58] rounded-lg overflow-hidden">
          <SectionHeader
            icon={<Activity className="h-3.5 w-3.5" />}
            title="거래 내역"
            right={`${filteredTrades.length}건`}
          />
          {filteredTrades.length > 0 ? (
            <>
              {/* 테이블 헤더 */}
              <div className="grid grid-cols-12 gap-0 px-3 py-1.5 border-b border-[#162e46] bg-[#11243c]">
                {(['구분', '종목', '가격', '수량', '금액', '시간'] as const).map((h, i) => (
                  <div key={h} className={cn(
                    'text-[9px] font-semibold text-[#80acd0] uppercase tracking-wide',
                    i === 0 ? 'col-span-1' : i === 1 ? 'col-span-3' : i === 2 ? 'col-span-2' :
                    i === 3 ? 'col-span-1' : i === 4 ? 'col-span-2 text-right' : 'col-span-3 text-right',
                  )}>
                    {h}
                  </div>
                ))}
              </div>
              {/* 테이블 바디 */}
              <div className="divide-y divide-[#162e46] max-h-[320px] overflow-y-auto">
                {filteredTrades.map((t, i) => {
                  const isBuy = t.type === 'BUY';
                  return (
                    <div key={i} className="grid grid-cols-12 gap-0 px-3 py-2 hover:bg-[#11243c] transition items-center">
                      <div className="col-span-1">
                        <span className={cn(
                          'inline-flex items-center gap-0.5 text-[10px] font-bold',
                          isBuy ? 'text-red-400' : 'text-blue-400',
                        )}>
                          {isBuy ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {isBuy ? '매수' : '매도'}
                        </span>
                      </div>
                      <div className="col-span-3">
                        <span className="text-[11px] font-semibold text-[#ecf5ff]">
                          {STOCK_NAMES[t.symbol] ?? t.symbol}
                        </span>
                        <div className="text-[8px] text-[#608ab0] font-mono">{t.symbol}</div>
                      </div>
                      <div className="col-span-2 text-[11px] font-mono tabular-nums text-[#d0e6f8]">
                        {fmt(t.price)}
                      </div>
                      <div className="col-span-1 text-[11px] font-mono text-[#9ec4de]">
                        {t.qty}주
                      </div>
                      <div className="col-span-2 text-right text-[10px] font-mono tabular-nums text-[#9ec4de]">
                        {fmtCompact(t.price * t.qty)}
                      </div>
                      <div className="col-span-3 text-right text-[9px] font-mono text-[#80acd0]">
                        {fmtTime(t.timestamp)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-10 text-[11px] text-[#608ab0]">
              거래 내역 없음
            </div>
          )}
        </div>

        {/* ── 미연결 상태 안내 (우측) ────────────────────────────────────── */}
        {!anyActive && allTrades.length === 0 && (
          <div className="bg-[#152e48] border border-[#1e3a58] rounded-lg p-6">
            <div className="text-[11px] text-[#608ab0] leading-relaxed space-y-1">
              <p className="text-[#80acd0] font-semibold">자동매매 연동 방법</p>
              <p>① <span className="text-[#1d6ef8]">자동매매</span> 탭에서 KIS 또는 Toss 연결</p>
              <p>② App Key / Secret / 계좌번호 입력</p>
              <p>③ 코스피 TOP 20 자동매매 시작</p>
            </div>
          </div>
        )}

      </div>{/* end RIGHT MAIN */}

    </div>
  );
}
