import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, RotateCcw, TrendingUp, Wallet, ShieldAlert,
  Award, ArrowUpRight, ArrowDownRight, BarChart3,
  Zap, ZapOff, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { BotConfig, MarketBar, SimulatedPortfolio, Trade, LogMessage, SignalClass } from '../types';
import { generateMockHistory, generateNextBar, computeIndicators, calcSwingLow } from '../utils';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { cn } from '../lib/utils';

interface Props {
  config: BotConfig;
}

export default function TradingSimulator({ config }: Props) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [simulationSpeed, setSimulationSpeed] = useState(1500);
  const [bars, setBars] = useState<MarketBar[]>([]);

  const defaultStartingVal = 1000000;
  const [startingCash, setStartingCash] = useState<number>(defaultStartingVal);
  const [startingCashInput, setStartingCashInput] = useState<string>(defaultStartingVal.toString());
  const startingCashRef = useRef<number>(defaultStartingVal);

  const [portfolio, setPortfolio] = useState<SimulatedPortfolio>({
    cash: defaultStartingVal,
    holdings: 0,
    avgBuyPrice: 0,
    totalValue: defaultStartingVal,
    peakValue: defaultStartingVal,
    maxDrawdown: 0,
    trades: [],
  });
  const [pnlHistory, setPnlHistory] = useState<{ timestamp: number; time: string; value: number; pnlPercent: number }[]>([]);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [currentSignalClass, setCurrentSignalClass] = useState<SignalClass>('관망');
  const [isLive, setIsLive] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // ── 실제 매매 연동 ─────────────────────────────────────────────────────────
  interface LiveSession {
    token: string; appKey: string; appSecret: string;
    cano: string; acntPrdtCd: string;
    serverType: 'virtual' | 'real'; savedAt: number;
  }
  const barsRef = useRef<MarketBar[]>([]);
  const [liveMode, setLiveMode]           = useState(false);
  const liveModeRef                        = useRef(false);
  const [liveSession, setLiveSession]     = useState<LiveSession | null>(null);
  const liveSessionRef                     = useRef<LiveSession | null>(null);
  const [livePosition, setLivePosition]   = useState<{ qty: number; avgPrice: number } | null>(null);
  const livePositionRef                    = useRef<{ qty: number; avgPrice: number } | null>(null);
  const [liveOrderQty, setLiveOrderQty]   = useState('1');
  const livePlacingRef                     = useRef(false);

  useEffect(() => {
    startingCashRef.current = startingCash;
  }, [startingCash]);

  // barsRef를 bars 상태와 동기화
  useEffect(() => { barsRef.current = bars; }, [bars]);

  // liveModeRef/liveSessionRef 동기화
  useEffect(() => { liveModeRef.current = liveMode; }, [liveMode]);
  useEffect(() => { liveSessionRef.current = liveSession; }, [liveSession]);

  // localStorage에서 KIS 세션 읽기 (10초마다 갱신)
  const readLiveSession = (): LiveSession | null => { // eslint-disable-line
    try {
      const raw = localStorage.getItem('tbbuilder:kis:live-session');
      if (!raw) return null;
      const s = JSON.parse(raw) as LiveSession;
      if (Date.now() - s.savedAt > 24 * 3600 * 1000) return null; // 24h 만료
      return s;
    } catch { return null; }
  };
  useEffect(() => {
    const refresh = () => {
      const s = readLiveSession();
      setLiveSession(s);
      if (!s) { setLiveMode(false); liveModeRef.current = false; }
    };
    refresh();
    const iv = setInterval(refresh, 10_000);
    return () => clearInterval(iv);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getStockCode = (symbol: string): string => {
    const m = symbol.match(/\b(\d{6})\b/);
    return m ? m[1] : symbol.trim();
  };

  const loadRealData = async (sym: string) => {
    setIsLoadingData(true);
    setIsLive(false);
    setCurrentSignalClass('관망');
    setLogs([]);
    setPnlHistory([]);

    const code = getStockCode(sym);
    const initialBalance = startingCashRef.current;
    const basePortfolio: SimulatedPortfolio = {
      cash: initialBalance, holdings: 0, avgBuyPrice: 0,
      totalValue: initialBalance, peakValue: initialBalance, maxDrawdown: 0, trades: [],
    };

    try {
      const candleRes = await fetch(`/api/stock/${code}/candles?count=100`);
      if (!candleRes.ok) throw new Error(`HTTP ${candleRes.status}`);
      const candles: { date: string; open: number; high: number; low: number; close: number; volume: number }[] =
        await candleRes.json();
      if (!Array.isArray(candles) || candles.length === 0)
        throw new Error('데이터 없음 — 종목코드를 확인하세요');

      const rawBars: MarketBar[] = candles.map(c => ({
        time: `${c.date.slice(4, 6)}/${c.date.slice(6, 8)}`,
        timestamp: new Date(
          `${c.date.slice(0, 4)}-${c.date.slice(4, 6)}-${c.date.slice(6, 8)}T00:00:00+09:00`,
        ).getTime(),
        open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
      }));

      let stockName = code;
      let marketStatus = '';
      try {
        const curRes = await fetch(`/api/stock/${code}/current`);
        if (curRes.ok) {
          const cur: { name: string; price: number; marketStatus: string } = await curRes.json();
          stockName = cur.name;
          marketStatus = cur.marketStatus;
          const today = new Date();
          const todayStr = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
          const lastBar = rawBars[rawBars.length - 1];
          if (lastBar?.time === todayStr) {
            rawBars[rawBars.length - 1] = {
              ...lastBar,
              close: cur.price,
              high: Math.max(lastBar.high, cur.price),
              low: Math.min(lastBar.low, cur.price),
            };
          } else {
            rawBars.push({
              time: todayStr,
              timestamp: today.getTime(),
              open: lastBar?.close ?? cur.price,
              high: cur.price,
              low: cur.price,
              close: cur.price,
              volume: 0,
            });
          }
        }
      } catch { /* 현재가 실패 시 마지막 종가 사용 */ }

      const computedBars = computeIndicators(rawBars, config);
      setBars(computedBars);
      setPortfolio(basePortfolio);
      setPnlHistory(computedBars.map(bar => ({
        timestamp: bar.timestamp,
        time: bar.time,
        value: initialBalance,
        pnlPercent: 0,
      })));
      setIsLive(true);

      const ts = new Date().toLocaleTimeString('ko-KR', { hour12: false });
      const statusLabel = marketStatus === 'OPEN' ? '🟢 장중' : marketStatus === 'CLOSE' ? '🔴 장마감' : '';
      setLogs([
        { id: 'l1', timestamp: ts, type: 'success', message: `✅ [${stockName}(${code})] 네이버증권 연결 성공 — ${rawBars.length}봉 수신 ${statusLabel}` },
        { id: 'l2', timestamp: ts, type: 'info',    message: `⚙️ MACD(${config.macdFast},${config.macdSlow},${config.macdSignal}) | RSI${config.rsiPeriod} | MA20/60/120 | 거래량MA${config.volumeMAPeriod}` },
        { id: 'l3', timestamp: ts, type: 'info',    message: `📊 신호 분류: Ross Cameron MACD+RSI — 골든크로스+RSI50-70=매수후보 / RSI>70+데드크로스=위험` },
        { id: 'l4', timestamp: ts, type: 'info',    message: `🛡️ 진입 ${config.tradeSize}% | 손절 -${config.stopLoss}% | 익절 +${config.takeProfit}% | 예수금 ${initialBalance.toLocaleString()}원` },
        { id: 'l5', timestamp: ts, type: 'info',    message: `🔄 실시간 시세 폴링: 5초 간격으로 현재가 갱신 중` },
      ]);
    } catch (err) {
      setIsLive(false);
      const mockBars = generateMockHistory(80, config);
      setBars(mockBars);
      setPortfolio(basePortfolio);
      setPnlHistory(mockBars.map(bar => ({ timestamp: bar.timestamp, time: bar.time, value: initialBalance, pnlPercent: 0 })));
      const ts = new Date().toLocaleTimeString('ko-KR', { hour12: false });
      setLogs([
        { id: 'e1', timestamp: ts, type: 'error',   message: `❌ 실시간 데이터 로드 실패 [${code}]: ${String(err)}` },
        { id: 'e2', timestamp: ts, type: 'warning', message: `⚠️ 가상 시뮬레이션 모드로 대체합니다. 종목코드(6자리)를 확인하세요.` },
        { id: 'e3', timestamp: ts, type: 'info',    message: `💡 가상 자산 계좌 활성화 완료. 초기 자산: ${initialBalance.toLocaleString()} 원` },
      ]);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadRealData(config.symbol);
  }, [config.symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (bars.length > 0) {
      const recalculated = computeIndicators(
        bars.map(b => ({ ...b, rsi: undefined, macd: undefined, macdSignal: undefined, macdHist: undefined, ma: undefined, volumeMA: undefined, ma20: undefined, ma60: undefined, ma120: undefined })),
        config,
      );
      setBars(recalculated);
      setCurrentSignalClass('관망');
    }
  }, [config.macdFast, config.macdSlow, config.macdSignal, config.rsiPeriod, config.maPeriod, config.volumeMAPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const addLog = (message: string, type: LogMessage['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substring(2, 9),
      timestamp, type, message,
    }]);
  };

  // ── Ross Cameron 신호 계산 (pure) ────────────────────────────────────────────
  const computeRossCameronSignal = (computed: MarketBar[], price: number): SignalClass => {
    const n = computed.length;
    if (n < 5) return '관망';
    const curr = computed[n - 1], prev = computed[n - 2];
    const currRsi = curr.rsi ?? 50;
    const currMacd = curr.macd ?? 0, currSig = curr.macdSignal ?? 0;
    const prevMacd = prev.macd ?? 0, prevSig = prev.macdSignal ?? 0;
    const currHist = curr.macdHist ?? 0, prevHist = prev.macdHist ?? 0;

    const isGoldenCross = prevMacd <= prevSig && currMacd > currSig;
    const isDeadCross   = prevMacd >= prevSig && currMacd < currSig;
    const histRising    = currHist > prevHist;
    const histTurningUp = histRising && prevHist <= 0 && currHist > 0;
    const rsiPrime      = currRsi >= 50 && currRsi <= 70;
    const rsiPullback   = currRsi >= 30 && currRsi < 50;
    const rsiOverbought = currRsi > 70;
    const aboveHMA100   = curr.hma100   != null && price > curr.hma100;
    const aboveMA20     = curr.ma20     != null && price > curr.ma20;
    const volumeConfirm = curr.volumeMA != null && curr.volume > curr.volumeMA;

    // MACDRSI Enhanced: 신호 강도 + 다이버전스
    const strength      = curr.signalStrength ?? 0;
    const hasBullishDiv = curr.bullishDiv ?? false;
    const hasBearishDiv = curr.bearishDiv ?? false;

    let score = 0;
    if (isGoldenCross)                  score += 3;
    else if (histTurningUp)             score += 1;
    if (histRising)                     score += 1;
    if (rsiPrime)                       score += 2;
    else if (rsiPullback && aboveMA20)  score += 1;
    if (volumeConfirm)                  score += 1;
    if (aboveHMA100)                    score += 1;
    // 신호 강도 보너스 (MACDRSI 가중 복합 점수)
    if (strength > 50)                  score += 2;
    else if (strength > 20)             score += 1;
    if (hasBullishDiv)                  score += 1;

    const isDangerous = (rsiOverbought && isDeadCross) || (hasBearishDiv && isDeadCross) || strength < -50;
    if (isDangerous) return '위험';
    if (score >= 6 && isGoldenCross && rsiPrime && strength > 0) return '매수후보';
    if (score >= 4 || (hasBullishDiv && strength > 30)) return '관심';
    return '관망';
  };

  // ── 실제 KIS 주문 실행 ───────────────────────────────────────────────────────
  const executeLiveTrade = async (signal: SignalClass, price: number, computed: MarketBar[]) => {
    const sess = liveSessionRef.current;
    if (!sess || livePlacingRef.current || !liveModeRef.current) return;

    const pos  = livePositionRef.current;
    const qty  = Math.max(1, parseInt(liveOrderQty) || 1);

    // 스윙저점 손절 / RR 1:2 익절 체크 (live 포지션 기준)
    let effectiveSignal = signal;
    if (pos && signal !== '위험') {
      const swingLow = calcSwingLow(computed, 10);
      const stopDist = pos.avgPrice - swingLow;
      const tpPrice  = pos.avgPrice + stopDist * 2;
      if (price <= swingLow) {
        effectiveSignal = '위험';
        addLog(`⛔ [실제] 스윙저점 손절: ${price.toLocaleString()} ≤ ${Math.round(swingLow).toLocaleString()}`, 'error');
      } else if (stopDist > 0 && price >= tpPrice) {
        effectiveSignal = '위험';
        addLog(`💰 [실제] RR 1:2 익절: ${price.toLocaleString()} ≥ ${Math.round(tpPrice).toLocaleString()}`, 'success');
      }
    }

    if (effectiveSignal !== '매수후보' && effectiveSignal !== '위험') return;
    if (effectiveSignal === '매수후보' && pos) return;  // 이미 포지션 보유
    if (effectiveSignal === '위험' && !pos) return;      // 포지션 없음

    livePlacingRef.current = true;
    const side   = effectiveSignal === '매수후보' ? 'buy' : 'sell';
    const ordQty = side === 'buy' ? qty : pos!.qty;

    const headers: Record<string, string> = {
      'Content-Type':   'application/json',
      'x-kis-token':    sess.token,
      'x-kis-appkey':   sess.appKey,
      'x-kis-appsecret': sess.appSecret,
      'x-kis-server':   sess.serverType,
    };

    try {
      const r = await fetch('/api/kis/order', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          cano: sess.cano, acntPrdtCd: sess.acntPrdtCd,
          pdno: getStockCode(config.symbol),
          ordDvsn: '01', ordQty, ordUnpr: 0, side,
        }),
      });
      const d = await r.json();

      if (d.rt_cd === '0') {
        if (side === 'buy') {
          const newPos = { qty: ordQty, avgPrice: price };
          livePositionRef.current = newPos;
          setLivePosition(newPos);
          addLog(`🟢 [실제매매] 매수 완료 — ${ordQty}주 @ ${price.toLocaleString()}원 (${d.output?.ODNO ?? '-'})`, 'buy');
        } else {
          const pct = ((price - pos!.avgPrice) / pos!.avgPrice * 100).toFixed(2);
          addLog(`🔴 [실제매매] 매도 완료 — ${ordQty}주 @ ${price.toLocaleString()}원 (${pct}%) (${d.output?.ODNO ?? '-'})`, 'sell');
          livePositionRef.current = null;
          setLivePosition(null);
        }
      } else {
        addLog(`❌ [실제매매] ${side === 'buy' ? '매수' : '매도'} 실패: ${d.msg1 ?? d.msg_cd ?? '오류'}`, 'error');
      }
    } catch (e) {
      addLog(`❌ [실제매매] 네트워크 오류: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      livePlacingRef.current = false;
    }
  };

  const runTradingLogic = (computedBars: MarketBar[], currentPrice: number, barRef: MarketBar) => {
    setPortfolio(prevPortfolio => {
      let { cash, holdings, avgBuyPrice, totalValue, peakValue, maxDrawdown, trades } = prevPortfolio;
      const currentUnit = '원';

      // 1. 손절 / 익절
      if (holdings > 0 && avgBuyPrice > 0) {
        const pnl = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;
        if (pnl <= -config.stopLoss) {
          const sellAmount = holdings * currentPrice;
          cash += sellAmount;
          trades = [...trades, { id: Math.random().toString(36).substring(2, 9), type: 'STOP_LOSS', price: currentPrice, quantity: holdings, amount: sellAmount, timestamp: barRef.timestamp, timeString: barRef.time, balanceAfter: cash, profitPercent: pnl, profitAmount: sellAmount - holdings * avgBuyPrice }];
          setTimeout(() => {
            addLog(`🚨 [손절매] 평단가 ${avgBuyPrice.toLocaleString()} 대비 -${config.stopLoss}% 돌파 → 시장가 청산`, 'error');
            addLog(`📊 실현손익: ${(sellAmount - holdings * avgBuyPrice).toLocaleString()}${currentUnit} (${pnl.toFixed(2)}%)`, 'error');
          }, 10);
          holdings = 0; avgBuyPrice = 0;
        } else if (pnl >= config.takeProfit) {
          const sellAmount = holdings * currentPrice;
          cash += sellAmount;
          trades = [...trades, { id: Math.random().toString(36).substring(2, 9), type: 'TAKE_PROFIT', price: currentPrice, quantity: holdings, amount: sellAmount, timestamp: barRef.timestamp, timeString: barRef.time, balanceAfter: cash, profitPercent: pnl, profitAmount: sellAmount - holdings * avgBuyPrice }];
          setTimeout(() => {
            addLog(`🎉 [익절매] +${config.takeProfit}% 목표 달성 → 시장가 청산`, 'success');
            addLog(`📊 실현수익: +${(sellAmount - holdings * avgBuyPrice).toLocaleString()}${currentUnit} (${pnl.toFixed(2)}%)`, 'success');
          }, 10);
          holdings = 0; avgBuyPrice = 0;
        }
      }

      // 2. Ross Cameron MACD+RSI 신호 계산
      const len = computedBars.length;
      if (len >= 5) {
        const currBar = computedBars[len - 1];
        const prevBar = computedBars[len - 2];
        const currRsi = currBar.rsi ?? 50;
        const currMacd = currBar.macd ?? 0, currSig = currBar.macdSignal ?? 0;
        const prevMacd = prevBar.macd ?? 0, prevSig = prevBar.macdSignal ?? 0;
        const currHist = currBar.macdHist ?? 0, prevHist = prevBar.macdHist ?? 0;

        const isGoldenCross  = prevMacd <= prevSig && currMacd > currSig;
        const isDeadCross    = prevMacd >= prevSig && currMacd < currSig;
        const histRising     = currHist > prevHist;
        const histTurningUp  = histRising && prevHist <= 0 && currHist > 0;

        const rsiPrime      = currRsi >= 50 && currRsi <= 70;
        const rsiPullback   = currRsi >= 30 && currRsi < 50;
        const rsiOverbought = currRsi > 70;

        const aboveHMA100   = currBar.hma100   != null && currentPrice > currBar.hma100;
        const aboveMA20     = currBar.ma20     != null && currentPrice > currBar.ma20;
        const volumeConfirm = currBar.volumeMA != null && currBar.volume > currBar.volumeMA;

        // MACDRSI Enhanced: 신호 강도 + 다이버전스
        const strength      = currBar.signalStrength ?? 0;
        const hasBullishDiv = currBar.bullishDiv ?? false;
        const hasBearishDiv = currBar.bearishDiv ?? false;

        let buyScore = 0;
        if (isGoldenCross)                         buyScore += 3;
        else if (histTurningUp)                    buyScore += 1;
        if (histRising)                            buyScore += 1;
        if (rsiPrime)                              buyScore += 2;
        else if (rsiPullback && aboveMA20)         buyScore += 1;
        if (volumeConfirm)                         buyScore += 1;
        if (aboveHMA100)                           buyScore += 1;
        // 신호 강도 보너스
        if (strength > 50)                         buyScore += 2;
        else if (strength > 20)                    buyScore += 1;
        if (hasBullishDiv)                         buyScore += 1;

        const isDangerous = (rsiOverbought && isDeadCross) || (hasBearishDiv && isDeadCross) || strength < -50;

        // Ross Cameron 포지션 관리: 스윙저점 손절 / RR 1:2 익절 (시뮬레이터 손절/익절보다 우선)
        let forceExit = false;
        if (holdings > 0 && avgBuyPrice > 0) {
          const swingLow = calcSwingLow(computedBars, 10);
          const stopDist = avgBuyPrice - swingLow;
          const tpPrice  = avgBuyPrice + stopDist * 2;
          if (currentPrice <= swingLow) {
            forceExit = true;
            setTimeout(() => addLog(`⛔ [스윙저점 손절] ${currentPrice.toLocaleString()}원 ≤ 스윙저점 ${Math.round(swingLow).toLocaleString()}원`, 'error'), 10);
          } else if (stopDist > 0 && currentPrice >= tpPrice) {
            forceExit = true;
            setTimeout(() => addLog(`💰 [RR 1:2 익절] ${currentPrice.toLocaleString()}원 ≥ 목표가 ${Math.round(tpPrice).toLocaleString()}원`, 'success'), 10);
          }
        }

        let newSignalClass: SignalClass;
        if (isDangerous || forceExit)                                          newSignalClass = '위험';
        else if (buyScore >= 6 && isGoldenCross && rsiPrime && strength > 0)  newSignalClass = '매수후보';
        else if (buyScore >= 4 || (hasBullishDiv && strength > 30))           newSignalClass = '관심';
        else                                                                   newSignalClass = '관망';

        setTimeout(() => setCurrentSignalClass(newSignalClass), 0);

        if (newSignalClass === '매수후보') {
          if (holdings > 0) {
            setTimeout(() => addLog(`🔔 매수후보 발생, 포지션 보유 중 생략 (${buyScore}/8점 | RSI ${currRsi.toFixed(1)})`, 'warning'), 10);
          } else {
            const buyBudget = cash * (config.tradeSize / 100);
            const qty = buyBudget / currentPrice;
            cash -= buyBudget; holdings = qty; avgBuyPrice = currentPrice;
            const flags = [
              isGoldenCross ? '①골든크로스' : null,
              histTurningUp ? '②히스트선전환' : histRising ? '②히스트↑' : null,
              rsiPrime      ? '③RSI모멘텀' : rsiPullback ? '③RSI눌림' : null,
              volumeConfirm ? '④거래량↑' : null,
              aboveHMA100   ? '⑤HMA위' : null,
            ].filter(Boolean).join(' ');
            trades = [...trades, { id: Math.random().toString(36).substring(2, 9), type: 'BUY', price: currentPrice, quantity: qty, amount: buyBudget, timestamp: barRef.timestamp, timeString: barRef.time, balanceAfter: cash }];
            setTimeout(() => {
              addLog(`★ [매수후보] ${buyScore}점 | 신호강도 ${strength > 0 ? '+' : ''}${strength}% | ${flags}`, 'buy');
              addLog(`🛒 매수: ${Math.floor(qty)}주 @ ${currentPrice.toLocaleString()}${currentUnit}`, 'buy');
            }, 10);
          }
        } else if (newSignalClass === '위험') {
          if (holdings > 0) {
            const sellAmount = holdings * currentPrice;
            const profitAmt = sellAmount - holdings * avgBuyPrice;
            const profitPct = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;
            cash += sellAmount;
            trades = [...trades, { id: Math.random().toString(36).substring(2, 9), type: 'SELL', price: currentPrice, quantity: holdings, amount: sellAmount, timestamp: barRef.timestamp, timeString: barRef.time, balanceAfter: cash, profitPercent: profitPct, profitAmount: profitAmt }];
            setTimeout(() => {
              if (!forceExit) addLog(`★ [위험신호] RSI 과열(>70) + 데드크로스${hasBearishDiv ? ' + 하락다이버전스' : ''}`, 'warning');
              addLog(`🔔 청산: ${Math.floor(holdings)}주 @ ${currentPrice.toLocaleString()}${currentUnit}`, 'sell');
              addLog(`📊 손익: ${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(2)}% (${profitAmt.toLocaleString()}${currentUnit})`, profitPct >= 0 ? 'success' : 'error');
            }, 10);
            holdings = 0; avgBuyPrice = 0;
          } else {
            setTimeout(() => addLog(`🔔 [위험감지] 데드크로스, 포지션 없어 관망. RSI: ${currRsi.toFixed(1)}`, 'info'), 10);
          }
        } else if (Math.random() < 0.25) {
          const volStr = currBar.volumeMA != null ? ` | Vol: ${currBar.volume}/${Math.round(currBar.volumeMA)}` : '';
          setTimeout(() => addLog(`[${newSignalClass}] ${currentPrice.toLocaleString()}원 | RSI: ${currRsi.toFixed(1)} | Hist: ${currHist.toFixed(2)} | ${buyScore}/8점${volStr}`, newSignalClass === '관심' ? 'success' : 'info'), 10);
        }
      }

      totalValue = cash + holdings * currentPrice;
      peakValue = Math.max(peakValue, totalValue);
      maxDrawdown = Math.max(maxDrawdown, ((peakValue - totalValue) / peakValue) * 100);

      const newPnlPercent = ((totalValue - startingCashRef.current) / startingCashRef.current) * 100;
      setTimeout(() => {
        setPnlHistory(prev => {
          const filtered = prev.filter(p => p.timestamp !== barRef.timestamp);
          const updated = [...filtered, { timestamp: barRef.timestamp, time: barRef.time, value: totalValue, pnlPercent: newPnlPercent }];
          if (updated.length > 120) updated.shift();
          return updated;
        });
      }, 0);

      return { cash, holdings, avgBuyPrice, totalValue, peakValue, maxDrawdown, trades };
    });
  };

  // Main simulation loop — live polling or mock generation
  useEffect(() => {
    if (!isPlaying || bars.length === 0) return;

    if (isLive) {
      const poll = setInterval(async () => {
        const code = getStockCode(config.symbol);
        try {
          const res = await fetch(`/api/stock/${code}/current`);
          if (!res.ok) return;
          const currentPrice = (await res.json() as { price: number }).price;

          // barsRef로 최신 bars를 동기적으로 읽어 지표 계산
          const prev = barsRef.current;
          if (!prev.length) return;
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          updated[lastIdx] = {
            ...updated[lastIdx],
            close: currentPrice,
            high: Math.max(updated[lastIdx].high, currentPrice),
            low:  Math.min(updated[lastIdx].low,  currentPrice),
          };
          const computedBars = computeIndicators(updated, config);
          barsRef.current = computedBars;
          setBars(computedBars);
          runTradingLogic(computedBars, currentPrice, computedBars[computedBars.length - 1]);

          // 실제 매매 실행 (liveModeRef.current가 true일 때만)
          if (liveModeRef.current) {
            const signal = computeRossCameronSignal(computedBars, currentPrice);
            await executeLiveTrade(signal, currentPrice, computedBars);
          }
        } catch { /* 일시적 네트워크 오류 무시 */ }
      }, 5000);
      return () => clearInterval(poll);
    }

    const interval = setInterval(() => {
      setBars(prevBars => {
        const lastBar = prevBars[prevBars.length - 1];
        const rawNextBar = generateNextBar(lastBar, config);
        const updatedRaw = [...prevBars, rawNextBar];
        if (updatedRaw.length > 120) updatedRaw.shift();

        const computedBars = computeIndicators(updatedRaw, config);
        const nextBar = computedBars[computedBars.length - 1];
        runTradingLogic(computedBars, nextBar.close, nextBar);
        return computedBars;
      });
    }, simulationSpeed);
    return () => clearInterval(interval);
  }, [isPlaying, isLive, simulationSpeed, config, bars.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dashboard calculations
  const currentPrice = bars[bars.length - 1]?.close || 0;
  const portfolioPnL = portfolio.totalValue - startingCash;
  const portfolioPnLPercent = startingCash > 0 ? (portfolioPnL / startingCash) * 100 : 0;

  const completedTrades = portfolio.trades.filter(t => t.type !== 'BUY');
  const winTrades = completedTrades.filter(t => (t.profitPercent ?? 0) > 0);
  const winRate = completedTrades.length > 0 ? (winTrades.length / completedTrades.length) * 100 : 0;

  const latestBarTimestamp = bars[bars.length - 1]?.timestamp || Date.now();
  const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
  const last30DaysTrades = completedTrades.filter(t => (latestBarTimestamp - t.timestamp) <= thirtyDaysInMs);
  const last30DaysWinTrades = last30DaysTrades.filter(t => (t.profitPercent ?? 0) > 0);
  const last30DaysWinRate = last30DaysTrades.length > 0
    ? (last30DaysWinTrades.length / last30DaysTrades.length) * 100 : 0;

  // SVG Chart helpers — W=1200 coordinate system, fontSize as SVG attribute
  const renderSVGChart = () => {
    if (bars.length < 5) return null;

    const W = 1200, H = 380;
    const PAD = { top: 30, right: 120, bottom: 28, left: 10 };
    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top - PAD.bottom;
    const visibleBars = bars.slice(-40);

    const priceValues: number[] = [];
    visibleBars.forEach(b => {
      priceValues.push(b.close);
      if (b.ma20  != null) priceValues.push(b.ma20);
      if (b.ma60  != null) priceValues.push(b.ma60);
      if (b.ma120 != null) priceValues.push(b.ma120);
    });
    const minP = Math.min(...priceValues) * 0.995;
    const maxP = Math.max(...priceValues) * 1.005;

    const gX = (i: number) => PAD.left + (i / (visibleBars.length - 1)) * cW;
    const gY = (v: number) => PAD.top + cH - ((v - minP) / (maxP - minP)) * cH;

    let priceLinePath = '';
    visibleBars.forEach((b, i) => {
      const x = gX(i), y = gY(b.close);
      priceLinePath += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    });

    let ma20Path = '', ma60Path = '', ma120Path = '';
    visibleBars.forEach((b, i) => {
      const x = gX(i);
      if (b.ma20  != null) ma20Path  += ma20Path  ? ` L ${x} ${gY(b.ma20)}`  : `M ${x} ${gY(b.ma20)}`;
      if (b.ma60  != null) ma60Path  += ma60Path  ? ` L ${x} ${gY(b.ma60)}`  : `M ${x} ${gY(b.ma60)}`;
      if (b.ma120 != null) ma120Path += ma120Path ? ` L ${x} ${gY(b.ma120)}` : `M ${x} ${gY(b.ma120)}`;
    });

    const avgY = portfolio.holdings > 0 ? gY(portfolio.avgBuyPrice) : null;
    const slY  = portfolio.holdings > 0 ? gY(portfolio.avgBuyPrice * (1 - config.stopLoss   / 100)) : null;
    const tpY  = portfolio.holdings > 0 ? gY(portfolio.avgBuyPrice * (1 + config.takeProfit / 100)) : null;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full block select-none">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const v = maxP - ratio * (maxP - minP), y = gY(v);
          return (
            <g key={idx}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#1e293b" strokeWidth="1" strokeDasharray="3,5" />
              <text x={W - PAD.right + 8} y={y + 5} fill="#64748b" fontSize={13} fontFamily="monospace">
                {v.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </text>
            </g>
          );
        })}

        {ma120Path && <path d={ma120Path} fill="none" stroke="#ec4899" strokeWidth="1.8" opacity="0.65" strokeDasharray="4,4" />}
        {ma60Path  && <path d={ma60Path}  fill="none" stroke="#38bdf8" strokeWidth="2"   opacity="0.8" />}
        {ma20Path  && <path d={ma20Path}  fill="none" stroke="#eab308" strokeWidth="2"   opacity="0.9" />}
        <path d={priceLinePath} fill="none" stroke="#10b981" strokeWidth="3" />

        {portfolio.holdings > 0 && avgY !== null && avgY >= PAD.top && avgY <= H - PAD.bottom && (
          <g>
            <line x1={PAD.left} y1={avgY} x2={W - PAD.right} y2={avgY} stroke="#3b82f6" strokeWidth="2" strokeDasharray="4,4" />
            <rect x={PAD.left + 6} y={avgY - 12} width={100} height={24} rx="5" fill="#1d4ed8" opacity="0.92" />
            <text x={PAD.left + 14} y={avgY + 5} fill="#fff" fontSize={12} fontFamily="monospace" fontWeight="bold">
              평단: {portfolio.avgBuyPrice.toLocaleString()}
            </text>
          </g>
        )}
        {portfolio.holdings > 0 && slY !== null && slY >= PAD.top && slY <= H - PAD.bottom && (
          <g>
            <line x1={PAD.left} y1={slY} x2={W - PAD.right} y2={slY} stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3,3" />
            <text x={W - PAD.right - 120} y={slY - 6} fill="#f43f5e" fontSize={13} fontFamily="monospace" fontWeight="600">
              손절선 (-{config.stopLoss}%)
            </text>
          </g>
        )}
        {portfolio.holdings > 0 && tpY !== null && tpY >= PAD.top && tpY <= H - PAD.bottom && (
          <g>
            <line x1={PAD.left} y1={tpY} x2={W - PAD.right} y2={tpY} stroke="#10b981" strokeWidth="1.5" strokeDasharray="3,3" />
            <text x={W - PAD.right - 120} y={tpY + 16} fill="#10b981" fontSize={13} fontFamily="monospace" fontWeight="600">
              익절선 (+{config.takeProfit}%)
            </text>
          </g>
        )}

        {portfolio.trades.map(t => {
          const barIdx = visibleBars.findIndex(b => Math.abs(b.timestamp - t.timestamp) < 500000);
          if (barIdx === -1) return null;
          const x = gX(barIdx), y = gY(t.price);
          const isBuy = t.type === 'BUY';
          const isStopLoss = t.type === 'STOP_LOSS', isTakeProfit = t.type === 'TAKE_PROFIT';
          const mc = isBuy ? '#10b981' : '#f43f5e';
          const label = isBuy ? '매수' : isStopLoss ? '손절' : isTakeProfit ? '익절' : '매도';
          const bgC = isBuy ? '#064e3b' : isStopLoss ? '#7f1d1d' : isTakeProfit ? '#14532d' : '#4c0519';
          return (
            <g key={t.id} className="group cursor-help">
              <line x1={x} y1={y} x2={x} y2={H - PAD.bottom} stroke={mc} strokeWidth="1.5" strokeDasharray="3,4" opacity="0.5" />
              <circle cx={x} cy={y} r="7" fill={mc} stroke="#0f172a" strokeWidth="2.5" />
              <line x1={x} y1={y} x2={x} y2={isBuy ? y - 20 : y + 20} stroke={mc} strokeWidth="2" />
              <rect x={x - 28} y={isBuy ? y - 40 : y + 20} width="56" height="20" rx="5" fill={bgC} stroke={mc} strokeWidth="1.5" />
              <text x={x} y={isBuy ? y - 27 : y + 33} fill="#fff" textAnchor="middle" fontSize={13} fontFamily="sans-serif" fontWeight="bold">{label}</text>
            </g>
          );
        })}
      </svg>
    );
  };

  const renderSVGMACD = () => {
    if (bars.length < 5) return null;
    const W = 1200, H = 160;
    const PAD = { top: 20, right: 120, bottom: 20, left: 10 };
    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top - PAD.bottom;
    const visibleBars = bars.slice(-40);
    const macds = visibleBars.map(b => b.macd ?? 0);
    const signals = visibleBars.map(b => b.macdSignal ?? 0);
    const hists = visibleBars.map(b => b.macdHist ?? 0);
    const maxAbs = Math.max(...macds.map(Math.abs), ...signals.map(Math.abs), ...hists.map(Math.abs), 0.01);
    const gX = (i: number) => PAD.left + (i / (visibleBars.length - 1)) * cW;
    const gY = (v: number) => PAD.top + cH / 2 - (v / maxAbs) * (cH / 2);
    const zeroY = gY(0);

    let macdPath = '', signalPath = '';
    visibleBars.forEach((b, i) => {
      const x = gX(i), mY = gY(b.macd ?? 0), sY = gY(b.macdSignal ?? 0);
      if (i === 0) { macdPath += `M ${x} ${mY}`; signalPath += `M ${x} ${sY}`; }
      else { macdPath += ` L ${x} ${mY}`; signalPath += ` L ${x} ${sY}`; }
    });

    const barStep = cW / (visibleBars.length - 1);
    const barHalfW = Math.max(2, barStep * 0.35);

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full block select-none">
        <line x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY} stroke="#334155" strokeWidth="1.5" />
        {visibleBars.map((b, i) => {
          const x = gX(i), histVal = b.macdHist ?? 0, hY = gY(histVal);
          return (
            <rect
              key={i}
              x={x - barHalfW} y={Math.min(zeroY, hY)}
              width={barHalfW * 2} height={Math.abs(zeroY - hY)}
              fill={histVal >= 0 ? '#10b981' : '#ef4444'} opacity="0.7"
            />
          );
        })}
        <path d={macdPath}   fill="none" stroke="#22d3ee" strokeWidth="2" />
        <path d={signalPath} fill="none" stroke="#f59e0b" strokeWidth="2" />
        <text x={PAD.left + 8} y={PAD.top + 15} fill="#22d3ee" fontSize={14} fontFamily="monospace" fontWeight="600">MACD</text>
        <text x={PAD.left + 70} y={PAD.top + 15} fill="#f59e0b" fontSize={14} fontFamily="monospace" fontWeight="600">Signal</text>
      </svg>
    );
  };

  const renderSVGRSI = () => {
    if (bars.length < 5) return null;
    const W = 1200, H = 140;
    const PAD = { top: 18, right: 120, bottom: 18, left: 10 };
    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top - PAD.bottom;
    const visibleBars = bars.slice(-40);
    const gX = (i: number) => PAD.left + (i / (visibleBars.length - 1)) * cW;
    const gY = (v: number) => PAD.top + cH - (v / 100) * cH;

    let rsiPath = '';
    visibleBars.forEach((b, i) => {
      const x = gX(i), y = gY(b.rsi ?? 50);
      rsiPath += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    });

    const obY = gY(config.rsiOverbought), osY = gY(config.rsiOversold);
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full block select-none">
        <rect x={PAD.left} y={obY} width={cW} height={osY - obY} fill="#1e1b4b" opacity="0.3" />
        <line x1={PAD.left} y1={obY} x2={W - PAD.right} y2={obY} stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="4,4" opacity="0.8" />
        <line x1={PAD.left} y1={osY} x2={W - PAD.right} y2={osY} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4,4" opacity="0.8" />
        <text x={W - PAD.right + 8} y={obY + 5}  fill="#f43f5e" fontSize={14} fontFamily="monospace">OB ({config.rsiOverbought})</text>
        <text x={W - PAD.right + 8} y={osY + 5}  fill="#38bdf8" fontSize={14} fontFamily="monospace">OS ({config.rsiOversold})</text>
        <path d={rsiPath} fill="none" stroke="#a855f7" strokeWidth="2.5" />
      </svg>
    );
  };

  const renderSVGPnL = () => {
    if (pnlHistory.length < 2) return null;
    const W = 1200, H = 130;
    const PAD = { top: 20, right: 120, bottom: 20, left: 10 };
    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top - PAD.bottom;

    const visibleBars = bars.slice(-40);
    const visiblePnL = visibleBars.map(bar => {
      const h = pnlHistory.find(p => p.timestamp === bar.timestamp);
      return { timestamp: bar.timestamp, pnlPercent: h ? h.pnlPercent : 0 };
    });

    const pnlVals = visiblePnL.map(p => p.pnlPercent);
    const maxVal = Math.max(...pnlVals.map(Math.abs), 1);
    const gX = (i: number) => PAD.left + (i / (visibleBars.length - 1)) * cW;
    const gY = (v: number) => PAD.top + cH / 2 - (v / maxVal) * (cH / 2);
    const zeroY = gY(0);

    let linePath = '', areaPath = '';
    visiblePnL.forEach((p, i) => {
      const x = gX(i), y = gY(p.pnlPercent);
      if (i === 0) { linePath += `M ${x} ${y}`; areaPath += `M ${x} ${zeroY} L ${x} ${y}`; }
      else { linePath += ` L ${x} ${y}`; areaPath += ` L ${x} ${y}`; }
      if (i === visiblePnL.length - 1) areaPath += ` L ${x} ${zeroY} Z`;
    });

    const lastPnL = pnlVals[pnlVals.length - 1] || 0;
    const sc = lastPnL >= 0 ? '#10b981' : '#f43f5e';

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full block select-none">
        <defs>
          <linearGradient id="pnl-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={sc} stopOpacity="0.3" />
            <stop offset="100%" stopColor={sc} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[-1, -0.5, 0, 0.5, 1].map((ratio, idx) => {
          const val = ratio * maxVal, y = gY(val);
          return (
            <g key={idx}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke={ratio === 0 ? '#475569' : '#1e293b'}
                strokeWidth={ratio === 0 ? '1.5' : '1'}
                strokeDasharray={ratio === 0 ? undefined : '3,5'} />
              <text x={W - PAD.right + 8} y={y + 5} fill={ratio === 0 ? '#94a3b8' : '#64748b'} fontSize={13} fontFamily="monospace">
                {val >= 0 ? '+' : ''}{val.toFixed(2)}%
              </text>
            </g>
          );
        })}
        <path d={areaPath} fill="url(#pnl-grad)" />
        <path d={linePath} fill="none" stroke={sc} strokeWidth="2.5" />
        {visiblePnL.length > 0 && (
          <g>
            <circle cx={gX(visiblePnL.length - 1)} cy={gY(lastPnL)} r="6"  fill={sc} />
            <circle cx={gX(visiblePnL.length - 1)} cy={gY(lastPnL)} r="10" fill={sc} opacity="0.3" />
          </g>
        )}
        <text x={PAD.left + 8} y={PAD.top + 16} fill={sc} fontSize={14} fontFamily="monospace" fontWeight="bold">
          누적 수익률: {lastPnL >= 0 ? '+' : ''}{lastPnL.toFixed(2)}%
        </text>
      </svg>
    );
  };

  const renderMiniPriceFlowList = () => {
    if (bars.length === 0) return <span className="text-xs text-muted-foreground font-mono">데이터 로딩 중...</span>;
    const recentBars = [...bars].slice(-5).reverse();
    return (
      <div className="w-full grid grid-cols-5 gap-1.5 text-center text-[11px] font-mono">
        {recentBars.map((b, i, arr) => {
          const prevBar = arr[i + 1] || bars[bars.indexOf(b) - 1];
          const change = prevBar ? b.close - prevBar.close : 0;
          const changePercent = prevBar ? (change / prevBar.close) * 100 : 0;
          const isUp = change >= 0;
          return (
            <div key={b.timestamp} className="bg-card p-1.5 rounded border border-border/60 flex flex-col justify-between h-[56px] min-w-0">
              <span className="text-[9px] text-muted-foreground truncate block">{b.time}</span>
              <span className={`font-bold block text-[10px] ${isUp ? 'text-emerald-400' : 'text-rose-500'}`}>
                {b.close.toLocaleString()}
              </span>
              <span className={`text-[9px] block ${isUp ? 'text-emerald-500' : 'text-rose-400'}`}>
                {change !== 0 ? <>{isUp ? '▲' : '▼'}{Math.abs(changePercent).toFixed(1)}%</> : '0.0%'}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const getLogTypeColor = (type: LogMessage['type']) => {
    switch (type) {
      case 'success': return 'text-emerald-400';
      case 'warning': return 'text-amber-400';
      case 'error': return 'text-rose-500 font-semibold';
      case 'buy': return 'text-emerald-500 font-bold bg-emerald-500/10 px-1 py-0.5 rounded';
      case 'sell': return 'text-rose-500 font-bold bg-rose-500/10 px-1 py-0.5 rounded';
      default: return 'text-[#b0b0b0]';
    }
  };

  const symbolLabel = config.symbol || '005930';
  const currencyUnit = '원';
  const lastBar = bars[bars.length - 1];

  return (
    <div className="space-y-6">
      {/* ── 전략 성과 대시보드 (3 카드) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/40 p-4 rounded-2xl border border-border/80 backdrop-blur-sm">
        {/* 최근 30일 승률 */}
        <Card className="flex items-center justify-between p-4 shadow-lg relative overflow-hidden group">
          <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
            <Award className="h-20 w-20 text-amber-400" />
          </div>
          <div className="space-y-1 z-10">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">최근 30일 승률</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-mono font-black text-amber-400">{last30DaysWinRate.toFixed(1)}%</span>
              <span className="text-[10px] text-muted-foreground font-semibold">({last30DaysWinTrades.length}승/{last30DaysTrades.length}회)</span>
            </div>
            <p className="text-[9px] text-muted-foreground leading-none">최근 30일 내 청산 완료 기준</p>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Award className="h-4 w-4" />
          </div>
        </Card>

        {/* 총 수익률 */}
        <Card className="flex items-center justify-between p-4 shadow-lg relative overflow-hidden group">
          <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
            <TrendingUp className="h-20 w-20 text-emerald-400" />
          </div>
          <div className="space-y-1 z-10">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">총 수익률</span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl font-mono font-black ${portfolioPnL >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                {portfolioPnL >= 0 ? '+' : ''}{portfolioPnLPercent.toFixed(2)}%
              </span>
              <span className="text-[10px] text-muted-foreground font-semibold">({portfolioPnL >= 0 ? '+' : ''}{portfolioPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}원)</span>
            </div>
            <p className="text-[9px] text-muted-foreground leading-none">시작 예수금 대비 현재 총 평가 자산</p>
          </div>
          <div className={`p-2.5 rounded-lg ${portfolioPnL >= 0 ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-500'}`}>
            {portfolioPnL >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
          </div>
        </Card>

        {/* 최대 낙폭 (MDD) */}
        <Card className="flex items-center justify-between p-4 shadow-lg relative overflow-hidden group">
          <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
            <ShieldAlert className="h-20 w-20 text-rose-400" />
          </div>
          <div className="space-y-1 z-10">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">최대 낙폭 (MDD)</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-mono font-black text-rose-400">-{portfolio.maxDrawdown.toFixed(2)}%</span>
              <span className="text-[10px] text-muted-foreground font-semibold">고점 대비 최하락</span>
            </div>
            <p className="text-[9px] text-muted-foreground leading-none">가상 자산 최대 손실폭</p>
          </div>
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <ShieldAlert className="h-4 w-4" />
          </div>
        </Card>
      </div>

      {/* ── 메인 그리드 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-white p-6 rounded-2xl border border-[#e5e5e5]">
        {/* 왼쪽: 컨트롤 + 포트폴리오 */}
        <div className="lg:col-span-1 flex flex-col space-y-4">
          {/* 헤더 + 데이터 소스 배지 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-foreground flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>실시간 자동매매 시뮬레이터</span>
              </h2>
              <Badge variant="ghost" className="text-xs font-mono rounded-md px-2 py-1">
                {symbolLabel} / {config.timeframe.toUpperCase()}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1.5 items-center mb-4">
              {isLoadingData ? (
                <Badge className="gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                  실시간 데이터 로딩 중...
                </Badge>
              ) : isLive ? (
                <Badge className="gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  LIVE · 네이버증권 (5초 폴링)
                </Badge>
              ) : (
                <Badge className="gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  유기적 가상 시뮬레이션 모드
                </Badge>
              )}
              <Badge
                className={cn(
                  'gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold',
                  currentSignalClass === '매수후보' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' :
                  currentSignalClass === '관심'    ? 'bg-blue-500/15 text-blue-400 border-blue-500/40' :
                  currentSignalClass === '위험'    ? 'bg-rose-500/15 text-rose-400 border-rose-500/40' :
                  'bg-muted text-muted-foreground border-border'
                )}
              >
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  currentSignalClass === '매수후보' ? 'bg-emerald-400 animate-pulse' :
                  currentSignalClass === '관심'    ? 'bg-blue-400' :
                  currentSignalClass === '위험'    ? 'bg-rose-400 animate-pulse' :
                  'bg-muted-foreground'
                )} />
                {currentSignalClass}
              </Badge>
            </div>
          </div>

          {/* 시작 예수금 설정 */}
          <Card className="p-3">
            <Label className="text-[11px] font-bold text-muted-foreground flex justify-between items-center">
              <span>시작 예수금 (Initial Cash)</span>
              <span className="text-[10px] text-emerald-400 font-mono">단위: 원</span>
            </Label>
            <div className="flex gap-2 mt-1.5">
              <Input
                type="text"
                value={startingCashInput}
                onChange={e => setStartingCashInput(e.target.value.replace(/[^0-9]/g, ''))}
                className="flex-1 text-xs font-mono h-8"
                placeholder="금액 입력"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const num = parseFloat(startingCashInput);
                  if (!isNaN(num) && num > 0) {
                    setStartingCash(num);
                    startingCashRef.current = num;
                    setTimeout(() => loadRealData(config.symbol), 50);
                  }
                }}
                className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 px-3 h-8 text-xs font-semibold"
              >
                적용
              </Button>
            </div>
            <div className="flex gap-1.5 mt-2">
              {[1000000, 5000000, 10000000, 50000000].map(preset => (
                <Button
                  key={preset}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStartingCashInput(preset.toString());
                    setStartingCash(preset);
                    startingCashRef.current = preset;
                    setTimeout(() => loadRealData(config.symbol), 50);
                  }}
                  className={cn(
                    'flex-1 text-[10px] font-mono py-1 h-auto rounded border transition',
                    startingCash === preset
                      ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/5 font-bold'
                      : 'border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  )}
                >
                  {`${(preset / 1000000).toLocaleString()}백만`}
                </Button>
              ))}
            </div>
          </Card>

          {/* 컨트롤 버튼 */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={isPlaying ? 'warning' : 'success'}
              size="sm"
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold h-auto"
            >
              {isPlaying
                ? <><Pause className="h-4 w-4" /><span>일시정지</span></>
                : <><Play className="h-4 w-4" /><span>시작하기</span></>}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSimulationSpeed(prev => prev === 2000 ? 1000 : prev === 1000 ? 400 : 2000)}
              className="flex items-center justify-center space-x-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold h-auto"
            >
              <span>배속: {simulationSpeed === 2000 ? '1x' : simulationSpeed === 1000 ? '2x' : '5x'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadRealData(config.symbol)}
              disabled={isLoadingData}
              className="flex items-center justify-center space-x-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold h-auto"
            >
              <RotateCcw className={cn('h-3.5 w-3.5', isLoadingData && 'animate-spin')} />
              <span>{isLoadingData ? '로딩중' : '초기화'}</span>
            </Button>
          </div>

          {/* 실제 매매 연동 */}
          <Card className={cn('p-3.5 space-y-3 border-2 transition-colors', liveMode ? 'border-rose-500/60 bg-rose-950/10' : 'border-border')}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {liveMode
                  ? <Zap    className="h-4 w-4 text-rose-400 animate-pulse" />
                  : <ZapOff className="h-4 w-4 text-fog" />}
                <span className="text-xs font-bold text-foreground">실제 매매 연동</span>
                {liveSession
                  ? <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 border border-emerald-700/40">{liveSession.serverType === 'real' ? '실전' : '모의'} KIS 연결됨</span>
                  : <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-fog border border-border">KIS 미연결</span>}
              </div>
              <button
                onClick={() => {
                  if (!liveSession) { addLog('⚠️ Broker 탭에서 KIS에 먼저 연결하세요.', 'warning'); return; }
                  const next = !liveMode;
                  setLiveMode(next); liveModeRef.current = next;
                  if (next) addLog(`🚨 실제 매매 모드 ON — ${liveSession.serverType === 'real' ? '실전' : '모의'} 계좌 (${liveSession.cano})`, 'warning');
                  else      addLog('실제 매매 모드 OFF', 'info');
                }}
                disabled={!liveSession}
                className={cn(
                  'text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all',
                  !liveSession  ? 'opacity-40 cursor-not-allowed bg-muted text-fog border-border' :
                  liveMode      ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700' :
                                  'bg-slate-800 text-slate-300 border-border hover:bg-slate-700',
                )}
              >
                {liveMode ? 'ON — 중지' : 'OFF — 시작'}
              </button>
            </div>

            {/* 경고문 */}
            {liveMode && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-rose-950/30 border border-rose-700/40">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-rose-300 leading-tight">
                  실제 투자금으로 자동 주문이 집행됩니다. 손실 위험이 있습니다.
                </p>
              </div>
            )}

            {/* 주문 수량 */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-fog shrink-0">주문 수량</span>
              <input
                type="number" min="1" value={liveOrderQty}
                onChange={e => setLiveOrderQty(e.target.value.replace(/[^0-9]/g, '') || '1')}
                className="w-16 text-xs font-mono text-center bg-slate-900 border border-border rounded px-2 py-1 text-foreground"
              />
              <span className="text-[10px] text-fog">주 · 시장가</span>
              <button
                onClick={() => {
                  const s = readLiveSession(); setLiveSession(s);
                  addLog(s ? 'KIS 세션 갱신 완료' : 'KIS 세션 없음 — Broker 탭 확인', s ? 'info' : 'warning');
                }}
                className="ml-auto p-1 rounded hover:bg-slate-800 text-fog hover:text-foreground"
                title="세션 갱신"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>

            {/* 실제 포지션 */}
            {livePosition ? (
              <div className="rounded-lg bg-slate-900 border border-slate-700 p-2.5 space-y-1">
                <p className="text-[10px] font-bold text-emerald-400">실제 포지션 보유</p>
                <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
                  <span className="text-fog">보유 수량</span>
                  <span className="text-right text-foreground">{livePosition.qty}주</span>
                  <span className="text-fog">평균 매수가</span>
                  <span className="text-right text-foreground">{livePosition.avgPrice.toLocaleString()}원</span>
                  {currentPrice > 0 && (
                    <>
                      <span className="text-fog">평가 손익</span>
                      <span className={cn('text-right font-bold', currentPrice >= livePosition.avgPrice ? 'text-emerald-400' : 'text-rose-400')}>
                        {((currentPrice - livePosition.avgPrice) / livePosition.avgPrice * 100).toFixed(2)}%
                      </span>
                    </>
                  )}
                </div>
              </div>
            ) : liveMode ? (
              <p className="text-[10px] text-fog text-center py-1">포지션 없음 — 매수후보 신호 대기 중</p>
            ) : null}
          </Card>

          {/* 포트폴리오 메트릭 */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Wallet className="h-3 w-3" /> 총 자산 가치
                  </p>
                  <p className="text-xl font-mono font-bold text-foreground mt-1">
                    {portfolio.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-xs text-muted-foreground">{currencyUnit}</span>
                  </p>
                </div>
                <Badge className={cn(
                  'text-xs font-mono font-bold px-2 py-1 rounded-lg',
                  portfolioPnL >= 0
                    ? 'bg-emerald-500/10 text-emerald-400 border-transparent'
                    : 'bg-rose-500/10 text-rose-400 border-transparent'
                )}>
                  {portfolioPnL >= 0 ? '+' : ''}{portfolioPnLPercent.toFixed(2)}%
                </Badge>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-muted-foreground mb-1">예수금 (Cash)</p>
                  <p className="font-mono text-foreground font-semibold">{portfolio.cash.toLocaleString(undefined, { maximumFractionDigits: 0 })} {currencyUnit}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">현재가</p>
                  <p className="font-mono text-emerald-400 font-semibold">{currentPrice ? currentPrice.toLocaleString() : '-'} {currencyUnit}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">보유 수량</p>
                  <p className="font-mono text-foreground font-semibold">{portfolio.holdings.toFixed(0)} 주</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">보유 평단가</p>
                  <p className="font-mono text-foreground font-semibold">
                    {portfolio.avgBuyPrice > 0 ? `${portfolio.avgBuyPrice.toLocaleString()} ${currencyUnit}` : '-'}
                  </p>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-muted-foreground mb-1">승률 (Win Rate)</p>
                  <p className="font-mono text-amber-400 font-bold">{winRate.toFixed(1)}% <span className="text-muted-foreground text-[10px] font-normal">({winTrades.length}/{completedTrades.length})</span></p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">최대 낙폭 (MDD)</p>
                  <p className="font-mono text-rose-400 font-semibold">-{portfolio.maxDrawdown.toFixed(2)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 최근 5봉 가격 흐름 */}
          <Card>
            <CardContent className="p-4 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                  <span>최근 5봉 가격 흐름</span>
                </span>
                <span className="font-mono text-emerald-400 font-bold text-[11px]">
                  {currentPrice ? `${currentPrice.toLocaleString()} 원` : '-'}
                </span>
              </div>
              <div className="bg-muted/40 rounded-lg p-2 border border-border/40">
                {renderMiniPriceFlowList()}
              </div>
            </CardContent>
          </Card>

          {/* 이동평균선 현재값 패널 */}
          <Card>
            <CardContent className="p-4 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
                  <span>실시간 이동평균선 (MA)</span>
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold">단위: 원</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted/80 border border-border/40 rounded-lg p-2.5">
                  <span className="text-[10px] font-bold text-amber-400 block mb-1 flex items-center justify-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> MA 20
                  </span>
                  <span className="text-xs font-mono font-bold text-foreground">
                    {lastBar?.ma20 ? `${lastBar.ma20.toLocaleString()}` : '-'}
                  </span>
                </div>
                <div className="bg-muted/80 border border-border/40 rounded-lg p-2.5">
                  <span className="text-[10px] font-bold text-sky-400 block mb-1 flex items-center justify-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span> MA 60
                  </span>
                  <span className="text-xs font-mono font-bold text-foreground">
                    {lastBar?.ma60 ? `${lastBar.ma60.toLocaleString()}` : '-'}
                  </span>
                </div>
                <div className="bg-muted/80 border border-border/40 rounded-lg p-2.5">
                  <span className="text-[10px] font-bold text-pink-400 block mb-1 flex items-center justify-center gap-1">
                    <span className="w-1.5 h-1 border-t border-dashed border-pink-500"></span> MA 120
                  </span>
                  <span className="text-xs font-mono font-bold text-foreground">
                    {lastBar?.ma120 ? `${lastBar.ma120.toLocaleString()}` : '-'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 리스크 안전 조건 — Ross Cameron */}
          <Card className="p-3.5 space-y-2 text-xs">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-emerald-400" /> Ross Cameron 매매 기준
            </p>
            <ul className="space-y-1 text-muted-foreground font-mono">
              <li className="flex items-center justify-between">
                <span>• 매수후보 (≥6점):</span>
                <span className="text-emerald-400">골든크로스+RSI 50-70</span>
              </li>
              <li className="flex items-center justify-between">
                <span>• 관심 (≥4점):</span>
                <span className="text-sky-400">눌림목 또는 히스트선전환</span>
              </li>
              <li className="flex items-center justify-between">
                <span>• 위험:</span>
                <span className="text-rose-400">RSI{'>'}70+데드크로스</span>
              </li>
              <li className="flex items-center justify-between">
                <span>• 손절:</span>
                <span className="text-rose-400">스윙저점(10봉) 이탈</span>
              </li>
              <li className="flex items-center justify-between">
                <span>• 익절:</span>
                <span className="text-emerald-400">RR 1:2 목표가 도달</span>
              </li>
              <li className="flex items-center justify-between">
                <span>• 추세 필터:</span>
                <span className="text-purple-400">HMA 100 + 거래량</span>
              </li>
            </ul>
          </Card>
        </div>

        {/* 오른쪽: 차트 + 터미널 */}
        <div className="lg:col-span-2 flex flex-col space-y-6">
          {/* 차트 패널 */}
          <Card className="p-4">
            <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
              <span className="text-xs font-semibold text-muted-foreground">차트 모니터링 (최근 40봉)</span>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>현재가</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>MA20</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>MA60</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1 border-t border-dashed border-pink-500"></span>MA120</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-1 border-t border-dashed border-blue-500"></span>평단가</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-1 border-t border-dashed border-rose-500"></span>손절선</span>
                <span className="flex items-center gap-1"><span className="w-2 h-1 bg-purple-500"></span>RSI</span>
                <span className="flex items-center gap-1"><span className="w-2 h-1.5 bg-emerald-500/20 border-t border-emerald-500"></span>누적손익</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="bg-white rounded-xl p-2 border border-[#e5e5e5]">
                {renderSVGChart()}
              </div>
              <div className="bg-white rounded-xl p-2 border border-[#e5e5e5]">
                {renderSVGMACD()}
              </div>
              <div className="bg-white rounded-xl p-2 border border-[#e5e5e5]">
                {renderSVGRSI()}
              </div>
              <div className="bg-white rounded-xl p-2 border border-[#e5e5e5]">
                {renderSVGPnL()}
              </div>
            </div>
          </Card>

          {/* 터미널 로그 */}
          <div className="flex flex-col h-[180px] bg-[#0d0d0d] border border-[#e5e5e5] rounded-xl overflow-hidden font-mono text-[11px] leading-relaxed">
            <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#1a1a1a] border-b border-[#333] text-[#888] select-none">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-[10px] ml-2 text-[#888] font-medium">TRADING SYSTEM SHELL</span>
              </div>
              <span className="text-[9px] bg-[#111] px-1.5 py-0.5 rounded text-[#666]">
                {isLive ? 'LIVE MODE' : 'SIM MODE'}
              </span>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-1 select-text">
                {logs.map(log => (
                  <div key={log.id} className="flex hover:bg-white/5 px-1 rounded transition-colors duration-150">
                    <span className="text-[#555] mr-2">[{log.timestamp}]</span>
                    <span className={getLogTypeColor(log.type)}>{log.message}</span>
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}
