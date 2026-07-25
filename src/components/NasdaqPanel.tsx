import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity, Bot, StopCircle, RefreshCw, Globe, Eye, EyeOff,
  ShieldCheck, BarChart2, CheckCircle2, AlertTriangle, Wallet,
} from 'lucide-react';
import { computeIndicators, calcSwingLow } from '../utils';
import type { MarketBar, SignalClass } from '../types';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

// ── NASDAQ Top 30 (시가총액 기준) ────────────────────────────────────────────
export const NASDAQ_TOP30: { symbol: string; name: string; sector: string }[] = [
  { symbol: 'AAPL',  name: 'Apple',               sector: 'Tech' },
  { symbol: 'MSFT',  name: 'Microsoft',            sector: 'Tech' },
  { symbol: 'NVDA',  name: 'NVIDIA',               sector: 'Semiconductor' },
  { symbol: 'AMZN',  name: 'Amazon',               sector: 'E-Commerce' },
  { symbol: 'META',  name: 'Meta',                 sector: 'Social' },
  { symbol: 'GOOGL', name: 'Alphabet A',           sector: 'Tech' },
  { symbol: 'TSLA',  name: 'Tesla',                sector: 'EV' },
  { symbol: 'AVGO',  name: 'Broadcom',             sector: 'Semiconductor' },
  { symbol: 'COST',  name: 'Costco',               sector: 'Retail' },
  { symbol: 'NFLX',  name: 'Netflix',              sector: 'Media' },
  { symbol: 'AMD',   name: 'AMD',                  sector: 'Semiconductor' },
  { symbol: 'QCOM',  name: 'Qualcomm',             sector: 'Semiconductor' },
  { symbol: 'ADBE',  name: 'Adobe',                sector: 'Software' },
  { symbol: 'AMAT',  name: 'Applied Materials',    sector: 'Semiconductor' },
  { symbol: 'TXN',   name: 'Texas Instruments',   sector: 'Semiconductor' },
  { symbol: 'LRCX',  name: 'Lam Research',         sector: 'Semiconductor' },
  { symbol: 'MU',    name: 'Micron Technology',    sector: 'Semiconductor' },
  { symbol: 'INTU',  name: 'Intuit',               sector: 'Software' },
  { symbol: 'PANW',  name: 'Palo Alto Networks',   sector: 'Cybersecurity' },
  { symbol: 'KLAC',  name: 'KLA Corp',             sector: 'Semiconductor' },
  { symbol: 'MRVL',  name: 'Marvell Technology',  sector: 'Semiconductor' },
  { symbol: 'SBUX',  name: 'Starbucks',            sector: 'Consumer' },
  { symbol: 'ISRG',  name: 'Intuitive Surgical',  sector: 'HealthTech' },
  { symbol: 'REGN',  name: 'Regeneron',            sector: 'Biotech' },
  { symbol: 'PYPL',  name: 'PayPal',               sector: 'Fintech' },
  { symbol: 'ASML',  name: 'ASML',                 sector: 'Semiconductor' },
  { symbol: 'ADP',   name: 'Automatic Data Proc.', sector: 'Software' },
  { symbol: 'CRWD',  name: 'CrowdStrike',          sector: 'Cybersecurity' },
  { symbol: 'MELI',  name: 'MercadoLibre',         sector: 'E-Commerce' },
  { symbol: 'INTC',  name: 'Intel',                sector: 'Semiconductor' },
];

// MACD+RSI 전략 파라미터 (코스피 TOP20과 동일)
const AUTO_CONFIG = {
  macdFast: 12, macdSlow: 26, macdSignal: 9,
  rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70,
  rsiLookback: 5, maPeriod: 20, volumeMAPeriod: 20, volumeThreshold: 1.5,
  stopLoss: 5, takeProfit: 10, tradeSize: 10,
  timeframe: '1h' as const, marketType: 'stock' as const, symbol: 'AAPL',
};

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface SymbolWatchState {
  signal: SignalClass;
  price: number;
  change: number;
  changePercent: number;
  position: { qty: number; avgPrice: number } | null;
  score: number;
  rsi: number;
  macd: number;
}

type LogType = 'info' | 'buy' | 'sell' | 'success' | 'error' | 'warning';
interface LogEntry { id: number; time: string; type: LogType; msg: string; }

type ConnStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
type MarketState = 'open' | 'pre' | 'after' | 'closed';

// ── US 시장 시간 ───────────────────────────────────────────────────────────────
function getUsMarketStatus(): { state: MarketState; label: string; kst: string } {
  const now   = new Date();
  const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et    = new Date(etStr);
  const day   = et.getDay();
  const total = et.getHours() * 60 + et.getMinutes();

  const kst = now.toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false,
  });

  if (day === 0 || day === 6) return { state: 'closed', label: '주말 (휴장)', kst };
  if (total >= 570  && total < 960)  return { state: 'open',  label: '정규장 개장 중', kst };
  if (total >= 240  && total < 570)  return { state: 'pre',   label: '프리마켓', kst };
  if (total >= 960  && total < 1200) return { state: 'after', label: '애프터마켓', kst };
  return { state: 'closed', label: '장 마감', kst };
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────────────────────
function SectionHeader({ icon, title, right }: {
  icon: React.ReactNode; title: string; right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[#1d6ef8]">{icon}</span>
      <span className="text-[11px] font-bold text-foreground">{title}</span>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function NasdaqPanel() {

  // ── Toss 연결 ──────────────────────────────────────────────────────────────
  const [tossClientId,     setTossClientId]     = useState('');
  const [tossClientSecret, setTossClientSecret] = useState('');
  const [showSecret,       setShowSecret]       = useState(false);
  const [connStatus,       setConnStatus]       = useState<ConnStatus>('disconnected');
  const [connError,        setConnError]        = useState('');
  const [accountSeq,       setAccountSeq]       = useState<number | null>(null);

  // ── 자동매매 state ──────────────────────────────────────────────────────────
  const [autoEnabled,      setAutoEnabled]      = useState(false);
  const [watchMap,         setWatchMap]         = useState<Record<string, SymbolWatchState>>({});
  const [logs,             setLogs]             = useState<LogEntry[]>([]);
  const [orderQty,         setOrderQty]         = useState('1');
  const [checkInterval,    setCheckInterval]    = useState(60);
  const [lastCheckTime,    setLastCheckTime]    = useState('');
  const [loadingCandles,   setLoadingCandles]   = useState(false);
  const [logFilter,        setLogFilter]        = useState<'all' | 'trade'>('all');
  const [candleProgress,   setCandleProgress]   = useState(0);

  // ── US 시장 상태 ────────────────────────────────────────────────────────────
  const [marketInfo, setMarketInfo] = useState(getUsMarketStatus());

  // ── refs (stale-closure 방지) ───────────────────────────────────────────────
  const autoEnabledRef      = useRef(false);
  const candlesMapRef       = useRef<Record<string, MarketBar[]>>({});
  const lastCandleDateRef   = useRef<Record<string, string>>({});
  const positionsMapRef     = useRef<Record<string, { qty: number; avgPrice: number } | null>>({});
  const placingMapRef       = useRef<Record<string, boolean>>({});
  const watchMapRef         = useRef<Record<string, SymbolWatchState>>({});
  const intervalRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const tossTokenRef        = useRef('');
  const tossTokenExpiryRef  = useRef<Date | null>(null);
  const tossAccountSeqRef   = useRef<number | null>(null);
  const tossClientIdRef     = useRef('');
  const tossClientSecretRef = useRef('');
  const orderQtyRef         = useRef('1');
  const logIdRef            = useRef(0);
  const consecErrRef        = useRef(0);

  // ── 로그 ─────────────────────────────────────────────────────────────────
  const addLog = useCallback((msg: string, type: LogType = 'info') => {
    setLogs(prev => [{
      id: ++logIdRef.current,
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type, msg,
    }, ...prev.slice(0, 499)]);
  }, []);

  // ── 체결 내역 저장 (대시보드 공유) ────────────────────────────────────────
  const saveTrade = useCallback((symbol: string, side: 'BUY' | 'SELL', price: number, qty: number) => {
    try {
      const raw = localStorage.getItem('tbbuilder:trades');
      const history: any[] = raw ? JSON.parse(raw) : [];
      history.push({
        id: Date.now(),
        code: symbol,
        name: NASDAQ_TOP30.find(s => s.symbol === symbol)?.name ?? symbol,
        side, price, timestamp: Date.now(), broker: 'toss-us', qty, currency: 'USD',
      });
      localStorage.setItem('tbbuilder:trades', JSON.stringify(history.slice(-200)));
    } catch {}
  }, []);

  // ── Toss 토큰 갱신 ────────────────────────────────────────────────────────
  const refreshTossToken = useCallback(async (): Promise<boolean> => {
    const now    = Date.now();
    const expiry = tossTokenExpiryRef.current;
    if (tossTokenRef.current && expiry && expiry.getTime() - now > 5 * 60_000) return true;

    const id  = tossClientIdRef.current;
    const sec = tossClientSecretRef.current;
    if (!id || !sec) return false;

    try {
      const r = await fetch('/api/toss/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: id, clientSecret: sec }),
      });
      const d = await r.json();
      const token = d.access_token ?? d.token;
      if (!token) return false;
      tossTokenRef.current       = token;
      tossTokenExpiryRef.current = new Date(now + 6 * 3600_000);
      localStorage.setItem('tbbuilder:toss:session', JSON.stringify({ token, savedAt: now }));
      return true;
    } catch { return false; }
  }, []);

  // ── Toss 연결 ─────────────────────────────────────────────────────────────
  const connectToss = useCallback(async () => {
    const id  = tossClientId.trim();
    const sec = tossClientSecret.trim();
    if (!id || !sec) { setConnError('Client ID와 Secret을 입력하세요'); return; }

    setConnStatus('connecting');
    setConnError('');
    tossClientIdRef.current     = id;
    tossClientSecretRef.current = sec;

    try {
      const r = await fetch('/api/toss/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: id, clientSecret: sec }),
      });
      const d     = await r.json();
      const token = d.access_token ?? d.token;
      if (!token) throw new Error(d.message ?? d.error ?? 'Token 발급 실패');

      tossTokenRef.current       = token;
      tossTokenExpiryRef.current = new Date(Date.now() + 6 * 3600_000);
      localStorage.setItem('tbbuilder:toss:session', JSON.stringify({ token, savedAt: Date.now() }));

      // 계좌 조회
      const accR = await fetch('/api/toss/accounts', { headers: { 'x-toss-token': token } });
      const accD = await accR.json();
      const accounts: any[] = accD.result ?? accD.accounts ?? [];
      if (accounts.length > 0) {
        const seq = accounts[0].seq ?? accounts[0].accountSeq ?? null;
        if (seq != null) { setAccountSeq(seq); tossAccountSeqRef.current = seq; }
      }

      setConnStatus('connected');
    } catch (e) {
      setConnStatus('error');
      setConnError(e instanceof Error ? e.message : '연결 실패');
    }
  }, [tossClientId, tossClientSecret]);

  // ── Yahoo Finance 일봉 캔들 로드 ─────────────────────────────────────────
  const loadCandles = useCallback(async (symbol: string) => {
    const res = await fetch(`/api/us-stock/${symbol}/candles?count=220`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: { date: string; open: number; high: number; low: number; close: number; volume: number }[] = await res.json();
    if (!Array.isArray(data) || data.length < 40) throw new Error(`데이터 부족 (${data.length}봉)`);

    const bars: MarketBar[] = data.map(c => ({
      time:      `${c.date.slice(4, 6)}/${c.date.slice(6, 8)}`,
      timestamp: new Date(`${c.date.slice(0, 4)}-${c.date.slice(4, 6)}-${c.date.slice(6, 8)}T00:00:00Z`).getTime(),
      open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
    }));

    candlesMapRef.current[symbol]     = bars;
    lastCandleDateRef.current[symbol] = data[data.length - 1].date;
  }, []);

  // ── 자동매매 사이클 ───────────────────────────────────────────────────────
  const runAutoCheck = useCallback(async () => {
    if (!autoEnabledRef.current) return;

    const tokenOk = await refreshTossToken();
    if (!tokenOk) { addLog('Toss 토큰 갱신 실패 — 다음 주기 재시도', 'warning'); return; }

    const tok = tossTokenRef.current;
    const seq = tossAccountSeqRef.current;

    // ① 배치 현재가 조회 (Yahoo Finance)
    let batchPrices: Record<string, number> = {};
    try {
      const syms = NASDAQ_TOP30.map(s => s.symbol).join(',');
      const r    = await fetch(`/api/us-stock/batch/quotes?symbols=${syms}`);
      if (r.ok) batchPrices = await r.json();
    } catch (e) {
      addLog(`현재가 배치 조회 실패: ${e instanceof Error ? e.message : '오류'}`, 'warning');
    }

    // ② 새 거래일 캔들 갱신 확인
    const etNow  = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const todayEt = `${etNow.getFullYear()}${String(etNow.getMonth() + 1).padStart(2, '0')}${String(etNow.getDate()).padStart(2, '0')}`;

    const updatedMap: Record<string, SymbolWatchState> = { ...watchMapRef.current };

    for (const { symbol, name } of NASDAQ_TOP30) {
      if (!autoEnabledRef.current) break;
      try {
        // 새 거래일이면 캔들 재로드
        if (lastCandleDateRef.current[symbol] && lastCandleDateRef.current[symbol] < todayEt) {
          try { await loadCandles(symbol); } catch {}
        }

        const bars = candlesMapRef.current[symbol];
        if (!bars || bars.length < 40) continue;

        const currentPrice = batchPrices[symbol] ?? 0;
        if (currentPrice <= 0) continue;

        // 마지막 봉 현재가로 업데이트
        const updatedBars = [...bars];
        updatedBars[updatedBars.length - 1] = {
          ...updatedBars[updatedBars.length - 1],
          close: currentPrice,
          high:  Math.max(updatedBars[updatedBars.length - 1].high, currentPrice),
          low:   Math.min(updatedBars[updatedBars.length - 1].low,  currentPrice),
        };
        candlesMapRef.current[symbol] = updatedBars;

        // ③ 지표 계산
        const computed = computeIndicators(updatedBars, AUTO_CONFIG);
        const n        = computed.length;
        if (n < 40) continue;

        const curr = computed[n - 1];
        const prev = computed[n - 2];

        const currRsi  = curr.rsi         ?? 50;
        const currMacd = curr.macd        ?? 0;
        const currSig  = curr.macdSignal  ?? 0;
        const currHist = curr.macdHist    ?? 0;
        const prevMacd = prev.macd        ?? 0;
        const prevSig  = prev.macdSignal  ?? 0;
        const prevHist = prev.macdHist    ?? 0;

        // ④ Ross Cameron MACD+RSI 전략
        const isGoldenCross = prevMacd <= prevSig && currMacd >  currSig;
        const isDeadCross   = prevMacd >= prevSig && currMacd <  currSig;
        const histRising    = currHist > prevHist;
        const histTurningUp = histRising && prevHist <= 0 && currHist > 0;
        const rsiPrime      = currRsi >= 50 && currRsi <= 70;
        const rsiPullback   = currRsi >= 30 && currRsi < 50;
        const rsiOverbought = currRsi > 70;
        const aboveHMA100   = curr.hma100   != null && currentPrice > curr.hma100;
        const aboveMA20     = curr.ma20     != null && currentPrice > curr.ma20;
        const volumeConfirm = curr.volumeMA != null && (curr.volume ?? 0) > curr.volumeMA;
        const hasBearishDiv = curr.bearishDiv ?? false;

        let buyScore = 0;
        if (isGoldenCross)                   buyScore += 3;
        else if (histTurningUp)              buyScore += 1;
        if (histRising)                      buyScore += 1;
        if (rsiPrime)                        buyScore += 2;
        else if (rsiPullback && aboveMA20)   buyScore += 1;
        if (volumeConfirm)                   buyScore += 1;
        if (aboveHMA100)                     buyScore += 1;

        const isDangerous = (rsiOverbought && isDeadCross) || (hasBearishDiv && isDeadCross);

        let signal: SignalClass = '관망';
        if (isDangerous)                                      signal = '위험';
        else if (buyScore >= 6 && isGoldenCross && rsiPrime) signal = '매수후보';
        else if (buyScore >= 4)                              signal = '관심';

        // ⑤ 포지션 관리: 스윙저점 손절 / RR 1:2 익절
        const position = positionsMapRef.current[symbol] ?? null;
        if (position && signal !== '위험') {
          const swingLow = calcSwingLow(computed, 10);
          const stopDist = position.avgPrice - swingLow;
          const tpPrice  = position.avgPrice + stopDist * 2;
          if (currentPrice <= swingLow) {
            signal = '위험';
            addLog(`[${name}] ⛔ Stop-loss: $${currentPrice.toFixed(2)} ≤ swing $${swingLow.toFixed(2)}`, 'sell');
          } else if (stopDist > 0 && currentPrice >= tpPrice) {
            signal = '위험';
            addLog(`[${name}] 💰 Take-profit: $${currentPrice.toFixed(2)} ≥ $${tpPrice.toFixed(2)} (RR 1:2)`, 'sell');
          }
        }

        const prevState = watchMapRef.current[symbol];
        const change        = batchPrices[symbol] ? (batchPrices[symbol] - (prevState?.price ?? batchPrices[symbol])) : 0;
        const changePercent = prevState?.price ? (change / prevState.price * 100) : 0;

        updatedMap[symbol] = { signal, price: currentPrice, change, changePercent, position, score: buyScore, rsi: currRsi, macd: currMacd };

        if (signal === '매수후보' || signal === '위험') {
          addLog(
            `[${symbol}] [${signal}] $${currentPrice.toFixed(2)} RSI:${currRsi.toFixed(1)} (${buyScore}/8)`,
            signal === '매수후보' ? 'buy' : 'sell',
          );
        }

        // ⑥ 자동 주문 실행
        if (signal === '매수후보' && !position && seq != null && tok && !placingMapRef.current[symbol]) {
          const qty = parseInt(orderQtyRef.current) || 1;
          addLog(`[${name}] ▶ Buy → ${qty}주 시장가`, 'buy');
          placingMapRef.current[symbol] = true;
          try {
            const r = await fetch('/api/toss/order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-toss-token': tok, 'x-toss-account-seq': String(seq) },
              body: JSON.stringify({ symbol, side: 'BUY', orderType: 'MARKET', quantity: String(qty), currency: 'USD' }),
            });
            const d  = await r.json();
            const ok = d.result?.orderId ?? d.orderId;
            if (ok) {
              const newPos = { qty, avgPrice: currentPrice };
              positionsMapRef.current[symbol]   = newPos;
              updatedMap[symbol] = { ...updatedMap[symbol], position: newPos };
              addLog(`[${name}] ✅ Buy ${qty}주 @ $${currentPrice.toFixed(2)} (${ok})`, 'success');
              saveTrade(symbol, 'BUY', currentPrice, qty);
              try {
                const s = JSON.parse(localStorage.getItem('tbbuilder:auto:nasdaq') ?? '{}');
                localStorage.setItem('tbbuilder:auto:nasdaq', JSON.stringify({ ...s, positions: positionsMapRef.current }));
              } catch {}
            } else {
              addLog(`[${name}] ❌ Buy 실패: ${d.message ?? d.error ?? '오류'}`, 'error');
            }
          } finally { placingMapRef.current[symbol] = false; }

        } else if (signal === '위험' && position && seq != null && tok && !placingMapRef.current[symbol]) {
          addLog(`[${name}] ▶ Sell → ${position.qty}주 시장가`, 'sell');
          placingMapRef.current[symbol] = true;
          try {
            const r = await fetch('/api/toss/order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-toss-token': tok, 'x-toss-account-seq': String(seq) },
              body: JSON.stringify({ symbol, side: 'SELL', orderType: 'MARKET', quantity: String(position.qty), currency: 'USD' }),
            });
            const d   = await r.json();
            const ok  = d.result?.orderId ?? d.orderId;
            const pct = ((currentPrice - position.avgPrice) / position.avgPrice * 100).toFixed(2);
            if (ok) {
              addLog(`[${name}] ✅ Sell ${position.qty}주 @ $${currentPrice.toFixed(2)} (${currentPrice >= position.avgPrice ? '+' : ''}${pct}%)`, 'success');
              saveTrade(symbol, 'SELL', currentPrice, position.qty);
              positionsMapRef.current[symbol] = null;
              updatedMap[symbol] = { ...updatedMap[symbol], position: null };
              try {
                const s = JSON.parse(localStorage.getItem('tbbuilder:auto:nasdaq') ?? '{}');
                localStorage.setItem('tbbuilder:auto:nasdaq', JSON.stringify({ ...s, positions: positionsMapRef.current }));
              } catch {}
            } else {
              addLog(`[${name}] ❌ Sell 실패: ${d.message ?? d.error ?? '오류'}`, 'error');
            }
          } finally { placingMapRef.current[symbol] = false; }
        }

      } catch (e) {
        addLog(`[${symbol}] 오류: ${e instanceof Error ? e.message : '알 수 없음'}`, 'error');
        consecErrRef.current++;
        if (consecErrRef.current >= 20) {
          addLog('❌ 연속 오류 과다 — 자동매매 자동 중단', 'error');
          autoEnabledRef.current = false; setAutoEnabled(false);
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
          return;
        }
      }
    }

    consecErrRef.current = 0;
    watchMapRef.current  = updatedMap;
    setWatchMap({ ...updatedMap });
    setLastCheckTime(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }, [addLog, refreshTossToken, loadCandles, saveTrade]);

  // ── 자동매매 시작 ─────────────────────────────────────────────────────────
  const startAutoTrade = useCallback(async () => {
    addLog(`나스닥 TOP 30 캔들 로드 중… (${NASDAQ_TOP30.length}개)`, 'info');
    setLoadingCandles(true);
    setCandleProgress(0);
    let loaded = 0;

    await Promise.allSettled(NASDAQ_TOP30.map(async ({ symbol }) => {
      if ((candlesMapRef.current[symbol]?.length ?? 0) >= 40) {
        loaded++;
        setCandleProgress(Math.round(loaded / NASDAQ_TOP30.length * 100));
        return;
      }
      try {
        await loadCandles(symbol);
        loaded++;
      } catch (e) {
        addLog(`[${symbol}] 캔들 로드 실패: ${e instanceof Error ? e.message : '오류'}`, 'error');
      }
      setCandleProgress(Math.round(loaded / NASDAQ_TOP30.length * 100));
    }));

    setLoadingCandles(false);
    const readyCnt = NASDAQ_TOP30.filter(({ symbol }) => (candlesMapRef.current[symbol]?.length ?? 0) >= 40).length;
    addLog(`${readyCnt}/${NASDAQ_TOP30.length}개 종목 준비 완료`, readyCnt > 0 ? 'success' : 'error');
    if (readyCnt === 0) return;

    autoEnabledRef.current = true;
    setAutoEnabled(true);
    orderQtyRef.current    = orderQty;
    consecErrRef.current   = 0;

    try {
      localStorage.setItem('tbbuilder:auto:nasdaq', JSON.stringify({
        active: true, qty: orderQty, interval: checkInterval,
        positions: positionsMapRef.current,
      }));
    } catch {}

    await runAutoCheck();
    intervalRef.current = setInterval(runAutoCheck, checkInterval * 1000);
    addLog(`✅ 자동매매 시작 — ${checkInterval}s 주기, ${orderQty}주`, 'success');
  }, [addLog, loadCandles, runAutoCheck, orderQty, checkInterval]);

  // ── 자동매매 중단 ─────────────────────────────────────────────────────────
  const stopAutoTrade = useCallback(() => {
    autoEnabledRef.current = false;
    setAutoEnabled(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    try {
      const s = JSON.parse(localStorage.getItem('tbbuilder:auto:nasdaq') ?? '{}');
      localStorage.setItem('tbbuilder:auto:nasdaq', JSON.stringify({ ...s, active: false }));
    } catch {}
    addLog('⛔ 자동매매 중단', 'warning');
  }, [addLog]);

  // ── 마운트: 자격증명 / 세션 복구 ──────────────────────────────────────────
  useEffect(() => {
    // Toss 자격증명 로드
    try {
      const raw = localStorage.getItem('tbbuilder:toss');
      if (raw) {
        const creds = JSON.parse(raw);
        if (creds.clientId)     { setTossClientId(creds.clientId);         tossClientIdRef.current     = creds.clientId; }
        if (creds.clientSecret) { setTossClientSecret(creds.clientSecret); tossClientSecretRef.current = creds.clientSecret; }
      }
    } catch {}

    // Toss 세션 복구 (자동매매 탭과 공유)
    try {
      const raw = localStorage.getItem('tbbuilder:toss:session');
      if (raw) {
        const session = JSON.parse(raw);
        if (session.token && session.savedAt && Date.now() - session.savedAt < 23 * 3600_000) {
          tossTokenRef.current       = session.token;
          tossTokenExpiryRef.current = new Date(session.savedAt + 23 * 3600_000);
          setConnStatus('connected');
          fetch('/api/toss/accounts', { headers: { 'x-toss-token': session.token } })
            .then(r => r.json())
            .then(d => {
              const accs: any[] = d.result ?? d.accounts ?? [];
              if (accs.length > 0) {
                const seq = accs[0].seq ?? accs[0].accountSeq ?? null;
                if (seq != null) { setAccountSeq(seq); tossAccountSeqRef.current = seq; }
              }
            })
            .catch(() => {});
        }
      }
    } catch {}

    // 포지션 복구
    try {
      const raw = localStorage.getItem('tbbuilder:auto:nasdaq');
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.positions) positionsMapRef.current = saved.positions;
      }
    } catch {}

    // 시장 상태 업데이트 타이머
    const iv = setInterval(() => setMarketInfo(getUsMarketStatus()), 30_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  // ── 파생 데이터 ───────────────────────────────────────────────────────────
  const holdings = NASDAQ_TOP30
    .map(({ symbol, name }) => {
      const w = watchMap[symbol];
      if (!w?.position) return null;
      const pnl    = w.price ? (w.price - w.position.avgPrice) * w.position.qty : 0;
      const pnlPct = w.price ? ((w.price - w.position.avgPrice) / w.position.avgPrice * 100) : 0;
      return { symbol, name, position: w.position, price: w.price, pnl, pnlPct };
    })
    .filter((h): h is NonNullable<typeof h> => h !== null);

  const totalCost  = holdings.reduce((s, h) => s + h.position.avgPrice * h.position.qty, 0);
  const totalPnl   = holdings.reduce((s, h) => s + h.pnl, 0);
  const totalPnlPct = totalCost > 0 ? totalPnl / totalCost * 100 : 0;

  const buyAlerts  = NASDAQ_TOP30.filter(({ symbol }) => watchMap[symbol]?.signal === '매수후보');
  const sellAlerts = NASDAQ_TOP30.filter(({ symbol }) => watchMap[symbol]?.signal === '위험');

  const filteredLogs = logFilter === 'trade'
    ? logs.filter(l => ['buy', 'sell', 'success'].includes(l.type))
    : logs;

  const candleLoaded = NASDAQ_TOP30.filter(({ symbol }) => (candlesMapRef.current[symbol]?.length ?? 0) >= 40).length;

  // ── 스타일 상수 ───────────────────────────────────────────────────────────
  const signalBadge: Record<SignalClass, string> = {
    '매수후보': 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/60',
    '관심':    'bg-amber-900/50 text-amber-300 border border-amber-700/60',
    '관망':    'bg-[#1e3a58]/80 text-[#80acd0] border border-[#264562]',
    '위험':    'bg-rose-900/50 text-rose-300 border border-rose-700/60',
  };
  const logColor: Record<string, string> = {
    buy:     'text-emerald-400',
    sell:    'text-rose-400',
    success: 'text-emerald-300',
    error:   'text-red-400',
    warning: 'text-amber-400',
    info:    'text-[#80acd0]',
  };
  const marketColor: Record<MarketState, string> = {
    open:   'text-emerald-400',
    pre:    'text-amber-400',
    after:  'text-amber-400',
    closed: 'text-[#80acd0]',
  };
  const isConnected = connStatus === 'connected';

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-3">

      {/* ── 상단: Toss 연결 + 시장 현황 ─────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">

        {/* Toss 연결 카드 */}
        <div className="xl:col-span-4 bg-card border border-border rounded-lg p-3">
          <SectionHeader
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
            title="토스증권 연결 (US 주식)"
            right={
              <div className={cn('flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full border', {
                'bg-emerald-900/30 border-emerald-700/50 text-emerald-400': connStatus === 'connected',
                'bg-[#1e3a58] border-[#264562] text-[#80acd0]':            connStatus === 'disconnected',
                'bg-amber-900/30 border-amber-700/50 text-amber-400':       connStatus === 'connecting',
                'bg-rose-900/30 border-rose-700/50 text-rose-400':          connStatus === 'error',
              })}>
                <span className={cn('h-1.5 w-1.5 rounded-full', {
                  'bg-emerald-400 animate-pulse': connStatus === 'connected',
                  'bg-[#264562]':                connStatus === 'disconnected',
                  'bg-amber-400 animate-pulse':   connStatus === 'connecting',
                  'bg-rose-400':                  connStatus === 'error',
                })} />
                {{ disconnected: '미연결', connecting: '연결 중…', connected: '연결됨', error: '오류' }[connStatus]}
              </div>
            }
          />

          {connStatus !== 'connected' ? (
            <div className="space-y-2">
              <div>
                <Label className="text-[10px] text-[#80acd0]">Client ID</Label>
                <Input value={tossClientId} onChange={e => setTossClientId(e.target.value)}
                  placeholder="토스증권 Client ID"
                  className="h-7 text-[11px] mt-0.5 font-mono" />
              </div>
              <div>
                <Label className="text-[10px] text-[#80acd0]">Client Secret</Label>
                <div className="relative mt-0.5">
                  <Input
                    type={showSecret ? 'text' : 'password'}
                    value={tossClientSecret} onChange={e => setTossClientSecret(e.target.value)}
                    placeholder="Client Secret"
                    className="h-7 text-[11px] font-mono pr-8"
                  />
                  <button onClick={() => setShowSecret(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#80acd0] hover:text-foreground cursor-pointer">
                    {showSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                </div>
              </div>
              {connError && <p className="text-[10px] text-rose-400">{connError}</p>}
              <Button size="sm" className="w-full h-7 text-[11px]"
                onClick={connectToss} disabled={connStatus === 'connecting'}>
                {connStatus === 'connecting' && <RefreshCw className="h-3 w-3 animate-spin mr-1" />}
                연결
              </Button>
              <p className="text-[9px] text-[#608ab0]">
                자동매매 탭에서 이미 연결한 경우 자동 복원됩니다.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between text-[10px]">
                <span className="text-[#80acd0]">계좌 Seq</span>
                <span className="font-mono text-foreground">#{accountSeq ?? '?'}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-[#80acd0]">거래 통화</span>
                <span className="text-foreground">USD</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-[#80acd0]">지원 시장</span>
                <span className="text-foreground">NASDAQ · NYSE</span>
              </div>
              <Button variant="outline" size="sm" className="w-full h-7 text-[10px] mt-1"
                onClick={() => { setConnStatus('disconnected'); tossTokenRef.current = ''; }}>
                연결 해제
              </Button>
            </div>
          )}
        </div>

        {/* US 시장 현황 + KPI */}
        <div className="xl:col-span-8 bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-3 mb-3">
            <Globe className="h-3.5 w-3.5 text-[#1d6ef8]" />
            <span className="text-[11px] font-bold text-foreground">US 시장 현황</span>
            <div className="ml-auto flex items-center gap-3">
              <span className={cn('text-[11px] font-bold', marketColor[marketInfo.state])}>
                ● {marketInfo.label}
              </span>
              <span className="text-[10px] font-mono text-[#80acd0]">KST {marketInfo.kst}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="bg-[#11243c] rounded p-2.5 text-center">
              <div className="text-[9px] text-[#80acd0] mb-1">감시 종목</div>
              <div className="text-[15px] font-bold tabular-nums text-foreground">{NASDAQ_TOP30.length}</div>
              <div className="text-[9px] text-[#608ab0]">종목</div>
            </div>
            <div className="bg-[#11243c] rounded p-2.5 text-center">
              <div className="text-[9px] text-[#80acd0] mb-1">캔들 로드</div>
              <div className="text-[15px] font-bold tabular-nums text-foreground">{candleLoaded}</div>
              <div className="text-[9px] text-[#608ab0]">/{NASDAQ_TOP30.length}</div>
            </div>
            <div className="bg-[#11243c] rounded p-2.5 text-center">
              <div className="text-[9px] text-[#80acd0] mb-1">보유 종목</div>
              <div className="text-[15px] font-bold tabular-nums text-foreground">{holdings.length}</div>
              <div className="text-[9px] text-[#608ab0]">종목</div>
            </div>
            <div className="bg-[#11243c] rounded p-2.5 text-center">
              <div className="text-[9px] text-[#80acd0] mb-1">평가손익</div>
              <div className={cn('text-[13px] font-bold tabular-nums', totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
              </div>
              <div className={cn('text-[9px] font-mono', totalPnlPct >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
                {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* 보유 포지션 미니 리스트 */}
          {holdings.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-1">
              {holdings.slice(0, 4).map(h => (
                <div key={h.symbol} className="flex items-center justify-between text-[10px] px-2 py-1 bg-[#11243c] rounded">
                  <span className="font-mono font-bold text-foreground">{h.symbol}</span>
                  <span className="text-[#80acd0] font-mono">${h.position.avgPrice.toFixed(2)}</span>
                  <span className={cn('font-mono font-bold', h.pnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                    {h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 자동매매 제어 ─────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center gap-3 flex-wrap">

          {/* 상태 표시 */}
          <div className={cn('flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border', {
            'bg-emerald-900/30 border-emerald-700/50 text-emerald-300': autoEnabled,
            'bg-[#11243c] border-[#264562] text-[#80acd0]':             !autoEnabled,
          })}>
            <span className={cn('h-2 w-2 rounded-full', autoEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-[#264562]')} />
            {autoEnabled ? `나스닥 TOP 30 감시 중 · ${checkInterval}s 주기` : '대기 중'}
            {lastCheckTime && autoEnabled && (
              <span className="text-[9px] text-[#80acd0] ml-1 font-normal">· {lastCheckTime}</span>
            )}
          </div>

          {/* 주문 수량 */}
          <div className="flex items-center gap-1.5">
            <Label className="text-[10px] text-[#80acd0] shrink-0">주문수량</Label>
            <Input
              value={orderQty}
              onChange={e => { setOrderQty(e.target.value); orderQtyRef.current = e.target.value; }}
              disabled={autoEnabled}
              className="h-7 w-14 text-[11px] text-center font-mono"
            />
            <span className="text-[10px] text-[#80acd0]">주</span>
          </div>

          {/* 조회 주기 */}
          <div className="flex items-center gap-1.5">
            <Label className="text-[10px] text-[#80acd0] shrink-0">주기</Label>
            <Input
              type="number" min={30} max={300} step={30}
              value={checkInterval} onChange={e => setCheckInterval(Number(e.target.value))}
              disabled={autoEnabled}
              className="h-7 w-16 text-[11px] text-center font-mono"
            />
            <span className="text-[10px] text-[#80acd0]">초</span>
          </div>

          {/* 시작 / 중단 */}
          {!autoEnabled ? (
            <Button
              size="sm" className="h-7 text-[11px] bg-[#1d6ef8] hover:bg-[#1252c9]"
              onClick={startAutoTrade}
              disabled={!isConnected || loadingCandles}
            >
              {loadingCandles
                ? <><RefreshCw className="h-3 w-3 animate-spin mr-1" />로드 중 {candleProgress}%</>
                : <><Bot className="h-3 w-3 mr-1" />나스닥 TOP 30 자동매매 시작</>
              }
            </Button>
          ) : (
            <Button variant="destructive" size="sm" className="h-7 text-[11px]" onClick={stopAutoTrade}>
              <StopCircle className="h-3 w-3 mr-1" />자동매매 중단
            </Button>
          )}
        </div>

        {/* 신호 알림 배너 */}
        {(buyAlerts.length > 0 || sellAlerts.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-border">
            {buyAlerts.map(({ symbol, name }) => (
              <div key={symbol} className="flex items-center gap-1 px-2 py-0.5 bg-emerald-950/50 border border-emerald-700/50 rounded text-[10px] animate-pulse">
                <span className="text-emerald-400 font-bold">▲ {symbol}</span>
                <span className="text-emerald-300">{name}</span>
                <span className="text-emerald-500 font-mono">${watchMap[symbol]?.price?.toFixed(2)}</span>
              </div>
            ))}
            {sellAlerts.map(({ symbol, name }) => (
              <div key={symbol} className="flex items-center gap-1 px-2 py-0.5 bg-rose-950/50 border border-rose-700/50 rounded text-[10px] animate-pulse">
                <span className="text-rose-400 font-bold">▼ {symbol}</span>
                <span className="text-rose-300">{name}</span>
                <span className="text-rose-500 font-mono">${watchMap[symbol]?.price?.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 감시 테이블 + 로그 ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">

        {/* 감시 테이블 */}
        <div className="xl:col-span-8 bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <BarChart2 className="h-3.5 w-3.5 text-[#1d6ef8]" />
            <span className="text-[11px] font-bold text-foreground">NASDAQ TOP 30 감시 테이블</span>
            <span className="text-[9px] text-[#80acd0] ml-auto">Ross Cameron MACD+RSI · 일봉 · USD</span>
          </div>
          <div className="overflow-auto max-h-[560px]">
            <table className="w-full text-[10px]">
              <thead className="sticky top-0 bg-[#11243c] border-b border-border z-10">
                <tr>
                  <th className="text-left px-2.5 py-1.5 text-[#80acd0] font-semibold w-14">티커</th>
                  <th className="text-left px-2.5 py-1.5 text-[#80acd0] font-semibold">종목명</th>
                  <th className="text-left px-2.5 py-1.5 text-[#80acd0] font-semibold hidden sm:table-cell">섹터</th>
                  <th className="text-right px-2.5 py-1.5 text-[#80acd0] font-semibold">현재가</th>
                  <th className="text-right px-2.5 py-1.5 text-[#80acd0] font-semibold hidden lg:table-cell">등락</th>
                  <th className="text-center px-2.5 py-1.5 text-[#80acd0] font-semibold">신호</th>
                  <th className="text-center px-2.5 py-1.5 text-[#80acd0] font-semibold">점수</th>
                  <th className="text-right px-2.5 py-1.5 text-[#80acd0] font-semibold">RSI</th>
                  <th className="text-right px-2.5 py-1.5 text-[#80acd0] font-semibold">포지션/손익</th>
                </tr>
              </thead>
              <tbody>
                {NASDAQ_TOP30.map(({ symbol, name, sector }) => {
                  const w       = watchMap[symbol];
                  const hasCan  = (candlesMapRef.current[symbol]?.length ?? 0) >= 40;
                  const pos     = w?.position ?? positionsMapRef.current[symbol] ?? null;
                  const pnlPct  = pos && w?.price ? ((w.price - pos.avgPrice) / pos.avgPrice * 100) : null;
                  const chg     = w?.changePercent ?? 0;

                  return (
                    <tr key={symbol} className={cn(
                      'border-b border-border/40 transition-colors',
                      pos ? 'bg-[#162e48]/40' : 'hover:bg-[#11243c]/60',
                    )}>
                      <td className="px-2.5 py-1.5">
                        <span className="font-mono font-bold text-foreground text-[11px]">{symbol}</span>
                      </td>
                      <td className="px-2.5 py-1.5">
                        <span className="text-[#80acd0]">{name}</span>
                      </td>
                      <td className="px-2.5 py-1.5 hidden sm:table-cell">
                        <span className="text-[9px] text-[#608ab0] bg-[#11243c] px-1.5 py-0.5 rounded">{sector}</span>
                      </td>
                      <td className="px-2.5 py-1.5 text-right">
                        <span className="font-mono text-foreground tabular-nums">
                          {w?.price ? `$${w.price.toFixed(2)}` : hasCan ? '—' : <span className="text-[#264562] text-[9px]">로드 전</span>}
                        </span>
                      </td>
                      <td className="px-2.5 py-1.5 text-right hidden lg:table-cell">
                        <span className={cn('font-mono tabular-nums', chg > 0 ? 'text-emerald-400' : chg < 0 ? 'text-rose-400' : 'text-[#80acd0]')}>
                          {w ? `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%` : '—'}
                        </span>
                      </td>
                      <td className="px-2.5 py-1.5 text-center">
                        {w?.signal ? (
                          <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold', signalBadge[w.signal])}>
                            {w.signal}
                          </span>
                        ) : (
                          <span className="text-[#264562]">—</span>
                        )}
                      </td>
                      <td className="px-2.5 py-1.5 text-center">
                        <span className="font-mono text-[#80acd0]">{w?.score != null ? `${w.score}/8` : '—'}</span>
                      </td>
                      <td className="px-2.5 py-1.5 text-right">
                        {w?.rsi != null ? (
                          <span className={cn('font-mono tabular-nums', {
                            'text-emerald-400': w.rsi >= 50 && w.rsi <= 70,
                            'text-rose-400':    w.rsi > 70,
                            'text-[#80acd0]':   w.rsi < 50,
                          })}>
                            {w.rsi.toFixed(1)}
                          </span>
                        ) : <span className="text-[#264562]">—</span>}
                      </td>
                      <td className="px-2.5 py-1.5 text-right">
                        {pos ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-foreground font-mono text-[9px]">
                              {pos.qty}주@${pos.avgPrice.toFixed(2)}
                            </span>
                            {pnlPct != null && (
                              <span className={cn('font-mono font-bold text-[9px]', pnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                                {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#264562]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 실행 로그 */}
        <div className="xl:col-span-4 bg-card border border-border rounded-lg overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2 shrink-0">
            <Activity className="h-3.5 w-3.5 text-[#1d6ef8]" />
            <span className="text-[11px] font-bold text-foreground">실행 로그</span>
            <div className="ml-auto flex gap-1">
              {(['all', 'trade'] as const).map(f => (
                <button key={f} onClick={() => setLogFilter(f)}
                  className={cn('text-[9px] px-1.5 py-0.5 rounded transition-colors cursor-pointer', {
                    'bg-[#1d6ef8] text-white':              logFilter === f,
                    'text-[#80acd0] hover:text-foreground': logFilter !== f,
                  })}>
                  {f === 'all' ? '전체' : '매매만'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-0.5 max-h-[560px]">
            {filteredLogs.length === 0 ? (
              <p className="text-[10px] text-[#264562] text-center pt-10">로그 없음</p>
            ) : filteredLogs.map(l => (
              <div key={l.id} className="flex gap-1.5 text-[9px] leading-relaxed">
                <span className="text-[#3e5878] font-mono shrink-0 tabular-nums">{l.time}</span>
                <span className={cn('break-all', logColor[l.type])}>{l.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 전략 설명 ─────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#1d6ef8]" />
          <span className="text-[11px] font-bold text-foreground">적용 전략 — Ross Cameron MACD+RSI (코스피 동일)</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-[10px] text-[#80acd0]">
          <div className="space-y-1">
            <p className="font-semibold text-foreground">매수 조건 (점수제 / 8점 만점)</p>
            <p>① MACD 골든크로스 +3점 <span className="text-[#608ab0]">(필수)</span></p>
            <p>② MACD 히스토그램 상승 +1점</p>
            <p>③ RSI 50-70 프라임존 +2점 <span className="text-[#608ab0]">(필수)</span></p>
            <p>④ RSI 30-50 + MA20 위 +1점</p>
            <p>⑤ 거래량 MA 돌파 +1점</p>
            <p>⑥ HMA100 위 +1점</p>
            <p className="text-[#1d6ef8] font-semibold mt-1">→ 6점+ AND 골든크로스 AND RSI 50-70 = 매수후보</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">매도 조건</p>
            <p>① RSI &gt; 70 + MACD 데드크로스 → 위험</p>
            <p>② 베어리시 다이버전스 + 데드크로스 → 위험</p>
            <p>③ 현재가 ≤ 스윙저점 (10봉) → 손절</p>
            <p>④ 현재가 ≥ 진입가 + 리스크×2 → RR 1:2 익절</p>
            <p className="font-semibold text-foreground mt-2">데이터 소스</p>
            <p>캔들: Yahoo Finance (일봉, 최대 500봉)</p>
            <p>현재가: Yahoo Finance v7 Quote (배치)</p>
            <p>주문: 토스증권 US 주식 (<span className="text-amber-400">USD</span>)</p>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-border flex items-center gap-1.5 text-[9px] text-amber-400">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          US 시장은 ET 09:30-16:00 (KST 22:30-05:00) 정규장 운영. 일봉 전략 특성상 당일 종가 확정 후 신호 정확도가 높아집니다.
        </div>
      </div>
    </div>
  );
}
