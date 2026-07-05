import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, RotateCcw, TrendingUp, Wallet, ShieldAlert,
  Award, ArrowUpRight, ArrowDownRight, BarChart3
} from 'lucide-react';
import { BotConfig, MarketBar, SimulatedPortfolio, Trade, LogMessage, SignalClass } from '../types';
import { generateMockHistory, generateNextBar, computeIndicators } from '../utils';

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

  useEffect(() => {
    startingCashRef.current = startingCash;
  }, [startingCash]);

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
        { id: 'l3', timestamp: ts, type: 'info',    message: `📊 신호 분류: 5조건 점수제 → 매수후보(5+)/관심(3~4)/관망/위험` },
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

      // 2. 5조건 점수 계산
      const len = computedBars.length;
      if (len >= 5) {
        const currBar = computedBars[len - 1];
        const prevBar = computedBars[len - 2];
        const currRsi = currBar.rsi ?? 50, prevRsi = prevBar.rsi ?? 50;
        const currMacd = currBar.macd ?? 0, currSig = currBar.macdSignal ?? 0;
        const prevMacd = prevBar.macd ?? 0, prevSig = prevBar.macdSignal ?? 0;
        const currHist = currBar.macdHist ?? 0, prevHist = prevBar.macdHist ?? 0;

        const isGoldenCross = prevMacd <= prevSig && currMacd > currSig;
        const isDeadCross   = prevMacd >= prevSig && currMacd < currSig;
        const histIncreasing = currHist > prevHist;
        const rsiCondition = (currRsi > config.rsiOversold && currRsi <= 50 && currRsi > prevRsi) || (prevRsi < 50 && currRsi >= 50);
        const aboveMA = currBar.ma20 != null && currentPrice > currBar.ma20;
        const volumeAboveAvg = currBar.volumeMA != null && currBar.volume > currBar.volumeMA;

        let buyScore = 0;
        if (isGoldenCross)   buyScore += 2;
        if (histIncreasing)  buyScore += 1;
        if (rsiCondition)    buyScore += 2;
        if (aboveMA)         buyScore += 1;
        if (volumeAboveAvg)  buyScore += 1;

        const wasOverbought = computedBars.slice(-config.rsiLookback).some(b => (b.rsi ?? 50) >= config.rsiOverbought);
        const isDangerous = wasOverbought && isDeadCross;

        let newSignalClass: SignalClass;
        if (isDangerous)        newSignalClass = '위험';
        else if (buyScore >= 5) newSignalClass = '매수후보';
        else if (buyScore >= 3) newSignalClass = '관심';
        else                    newSignalClass = '관망';

        setTimeout(() => setCurrentSignalClass(newSignalClass), 0);

        if (newSignalClass === '매수후보') {
          if (holdings > 0) {
            setTimeout(() => addLog(`🔔 매수후보 발생, 포지션 보유 중 생략 (${buyScore}/7점 | RSI ${currRsi.toFixed(1)})`, 'warning'), 10);
          } else {
            const buyBudget = cash * (config.tradeSize / 100);
            const qty = buyBudget / currentPrice;
            cash -= buyBudget; holdings = qty; avgBuyPrice = currentPrice;
            const flags = [isGoldenCross ? '①크로스' : null, histIncreasing ? '②히스토그램↑' : null, rsiCondition ? '③RSI반등' : null, aboveMA ? '④MA위' : null, volumeAboveAvg ? '⑤거래량↑' : null].filter(Boolean).join(' ');
            trades = [...trades, { id: Math.random().toString(36).substring(2, 9), type: 'BUY', price: currentPrice, quantity: qty, amount: buyBudget, timestamp: barRef.timestamp, timeString: barRef.time, balanceAfter: cash }];
            setTimeout(() => {
              addLog(`★ [매수후보] ${buyScore}/7점 → ${flags}`, 'buy');
              addLog(`🛒 매수: ${Math.floor(qty)}주 @ ${currentPrice.toLocaleString()}${currentUnit}`, 'buy');
              addLog(`⚠️ [MACD 후행성] 추세 전환 이후 신호가 발생하므로 진입이 늦을 수 있습니다.`, 'warning');
              addLog(`⚠️ [RSI 한계] 강한 추세에서는 RSI가 과매도 구간에 장기 체류할 수 있습니다.`, 'warning');
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
              addLog(`★ [위험신호] RSI 과열(≥${config.rsiOverbought}) + 데드크로스. RSI: ${currRsi.toFixed(1)}`, 'warning');
              addLog(`🔔 청산: ${Math.floor(holdings)}주 @ ${currentPrice.toLocaleString()}${currentUnit}`, 'sell');
              addLog(`📊 손익: ${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(2)}% (${profitAmt.toLocaleString()}${currentUnit})`, profitPct >= 0 ? 'success' : 'error');
              addLog(`⚠️ [MACD 후행성] 데드크로스는 실제 고점 이후 발생할 수 있습니다.`, 'warning');
            }, 10);
            holdings = 0; avgBuyPrice = 0;
          } else {
            setTimeout(() => addLog(`🔔 [위험감지] 데드크로스, 포지션 없어 관망. RSI: ${currRsi.toFixed(1)}`, 'info'), 10);
          }
        } else if (Math.random() < 0.25) {
          const volStr = currBar.volumeMA != null ? ` | Vol: ${currBar.volume}/${Math.round(currBar.volumeMA)}` : '';
          setTimeout(() => addLog(`[${newSignalClass}] ${currentPrice.toLocaleString()}원 | RSI: ${currRsi.toFixed(1)} | Hist: ${currHist.toFixed(2)} | ${buyScore}/7점${volStr}`, newSignalClass === '관심' ? 'success' : 'info'), 10);
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
          const cur: { price: number } = await res.json();

          setBars(prevBars => {
            if (!prevBars.length) return prevBars;
            const updated = [...prevBars];
            const last = { ...updated[updated.length - 1] };
            const currentPrice = cur.price;
            last.close = currentPrice;
            last.high = Math.max(last.high, currentPrice);
            last.low = Math.min(last.low, currentPrice);
            updated[updated.length - 1] = last;

            const computedBars = computeIndicators(updated, config);
            runTradingLogic(computedBars, currentPrice, computedBars[computedBars.length - 1]);
            return computedBars;
          });
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

  // SVG Chart helpers
  const renderSVGChart = () => {
    if (bars.length < 5) return null;

    const width = 800, height = 260;
    const padding = { top: 20, right: 65, bottom: 20, left: 20 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const visibleBars = bars.slice(-40);

    const priceValues: number[] = [];
    visibleBars.forEach(b => {
      priceValues.push(b.close);
      if (b.ma20 != null) priceValues.push(b.ma20);
      if (b.ma60 != null) priceValues.push(b.ma60);
      if (b.ma120 != null) priceValues.push(b.ma120);
    });
    const minClose = Math.min(...priceValues) * 0.995;
    const maxClose = Math.max(...priceValues) * 1.005;

    const getX = (i: number) => padding.left + (i / (visibleBars.length - 1)) * chartWidth;
    const getY = (v: number) => padding.top + chartHeight - ((v - minClose) / (maxClose - minClose)) * chartHeight;

    let priceLinePath = '';
    visibleBars.forEach((b, i) => {
      const x = getX(i), y = getY(b.close);
      if (i === 0) priceLinePath += `M ${x} ${y}`;
      else priceLinePath += ` L ${x} ${y}`;
    });

    let ma20Path = '', ma60Path = '', ma120Path = '';
    visibleBars.forEach((b, i) => {
      const x = getX(i);
      if (b.ma20 != null) {
        const y = getY(b.ma20);
        ma20Path += ma20Path ? ` L ${x} ${y}` : `M ${x} ${y}`;
      }
      if (b.ma60 != null) {
        const y = getY(b.ma60);
        ma60Path += ma60Path ? ` L ${x} ${y}` : `M ${x} ${y}`;
      }
      if (b.ma120 != null) {
        const y = getY(b.ma120);
        ma120Path += ma120Path ? ` L ${x} ${y}` : `M ${x} ${y}`;
      }
    });

    const averageBuyY = portfolio.holdings > 0 ? getY(portfolio.avgBuyPrice) : null;
    const stopLossY = portfolio.holdings > 0 ? getY(portfolio.avgBuyPrice * (1 - config.stopLoss / 100)) : null;
    const takeProfitY = portfolio.holdings > 0 ? getY(portfolio.avgBuyPrice * (1 + config.takeProfit / 100)) : null;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full text-slate-400 font-sans select-none">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const priceAtRatio = maxClose - ratio * (maxClose - minClose);
          const y = getY(priceAtRatio);
          return (
            <g key={idx}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#1e293b" strokeWidth="1" strokeDasharray="2,4" />
              <text x={width - padding.right + 5} y={y + 4} fill="#64748b" className="text-[10px] font-mono">
                {priceAtRatio.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </text>
            </g>
          );
        })}

        {ma120Path && <path d={ma120Path} fill="none" stroke="#ec4899" strokeWidth="1.2" opacity="0.65" strokeDasharray="3,3" />}
        {ma60Path && <path d={ma60Path} fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.75" />}
        {ma20Path && <path d={ma20Path} fill="none" stroke="#eab308" strokeWidth="1.5" opacity="0.85" />}

        <path d={priceLinePath} fill="none" stroke="#10b981" strokeWidth="2.5" className="drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]" />

        {portfolio.holdings > 0 && averageBuyY !== null && averageBuyY >= padding.top && averageBuyY <= height - padding.bottom && (
          <g>
            <line x1={padding.left} y1={averageBuyY} x2={width - padding.right} y2={averageBuyY} stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3,3" />
            <rect x={padding.left + 5} y={averageBuyY - 9} width="70" height="18" rx="4" fill="#1d4ed8" opacity="0.9" />
            <text x={padding.left + 9} y={averageBuyY + 3} fill="#ffffff" className="text-[9px] font-mono font-bold">평단가: {portfolio.avgBuyPrice.toLocaleString()}</text>
          </g>
        )}

        {portfolio.holdings > 0 && stopLossY !== null && stopLossY >= padding.top && stopLossY <= height - padding.bottom && (
          <g>
            <line x1={padding.left} y1={stopLossY} x2={width - padding.right} y2={stopLossY} stroke="#f43f5e" strokeWidth="1" strokeDasharray="2,2" />
            <text x={width - padding.right - 65} y={stopLossY - 4} fill="#f43f5e" className="text-[9px] font-mono font-semibold">손절매선 (-{config.stopLoss}%)</text>
          </g>
        )}

        {portfolio.holdings > 0 && takeProfitY !== null && takeProfitY >= padding.top && takeProfitY <= height - padding.bottom && (
          <g>
            <line x1={padding.left} y1={takeProfitY} x2={width - padding.right} y2={takeProfitY} stroke="#10b981" strokeWidth="1" strokeDasharray="2,2" />
            <text x={width - padding.right - 65} y={takeProfitY + 10} fill="#10b981" className="text-[9px] font-mono font-semibold">익절선 (+{config.takeProfit}%)</text>
          </g>
        )}

        {portfolio.trades.map(t => {
          const barIdx = visibleBars.findIndex(b => Math.abs(b.timestamp - t.timestamp) < 500000);
          if (barIdx === -1) return null;
          const x = getX(barIdx), y = getY(t.price);
          const isBuy = t.type === 'BUY';
          const isStopLoss = t.type === 'STOP_LOSS';
          const isTakeProfit = t.type === 'TAKE_PROFIT';
          const isSell = !isBuy;
          const markerColor = isBuy ? '#10b981' : '#f43f5e';
          const label = isBuy ? '매수' : isStopLoss ? '손절' : isTakeProfit ? '익절' : '매도';
          const bgColor = isBuy ? '#064e3b' : isStopLoss ? '#7f1d1d' : isTakeProfit ? '#14532d' : '#4c0519';
          const hoverLabel = `${label}: ${t.price.toLocaleString()}원 (${Math.floor(t.quantity)}주)`;

          return (
            <g key={t.id} className="group cursor-help">
              <line x1={x} y1={y} x2={x} y2={height - padding.bottom} stroke={markerColor} strokeWidth="1" strokeDasharray="2,3" opacity="0.4" className="group-hover:opacity-80 transition-opacity duration-150" />
              <circle cx={x} cy={y} r="5" fill={markerColor} stroke="#0f172a" strokeWidth="2" />
              <line x1={x} y1={y} x2={x} y2={isBuy ? y - 16 : y + 16} stroke={markerColor} strokeWidth="1.5" />
              <rect x={x - 24} y={isBuy ? y - 32 : y + 16} width="48" height="16" rx="4" fill={bgColor} stroke={markerColor} strokeWidth="1" />
              <text x={x} y={isBuy ? y - 21 : y + 27} fill="#ffffff" textAnchor="middle" className="text-[9px] font-sans font-bold select-none">{label}</text>
              <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none">
                <rect x={x - 65} y={isBuy ? y - 56 : y + 36} width="130" height="20" rx="4" fill="#0f172a" stroke={markerColor} strokeWidth="1" />
                <text x={x} y={isBuy ? y - 43 : y + 49} fill="#ffffff" textAnchor="middle" className="text-[9px] font-mono">{hoverLabel}</text>
              </g>
            </g>
          );
        })}
      </svg>
    );
  };

  const renderSVGMACD = () => {
    if (bars.length < 5) return null;
    const width = 800, height = 110;
    const padding = { top: 10, right: 65, bottom: 10, left: 20 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const visibleBars = bars.slice(-40);
    const macds = visibleBars.map(b => b.macd ?? 0);
    const signals = visibleBars.map(b => b.macdSignal ?? 0);
    const hists = visibleBars.map(b => b.macdHist ?? 0);
    const maxAbsVal = Math.max(...macds.map(Math.abs), ...signals.map(Math.abs), ...hists.map(Math.abs), 0.01);
    const getX = (i: number) => padding.left + (i / (visibleBars.length - 1)) * chartWidth;
    const getY = (v: number) => padding.top + chartHeight / 2 - (v / maxAbsVal) * (chartHeight / 2);

    let macdPath = '', signalPath = '';
    visibleBars.forEach((b, i) => {
      const x = getX(i);
      const mY = getY(b.macd ?? 0), sY = getY(b.macdSignal ?? 0);
      if (i === 0) { macdPath += `M ${x} ${mY}`; signalPath += `M ${x} ${sY}`; }
      else { macdPath += ` L ${x} ${mY}`; signalPath += ` L ${x} ${sY}`; }
    });

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full select-none">
        <line x1={padding.left} y1={getY(0)} x2={width - padding.right} y2={getY(0)} stroke="#334155" strokeWidth="1" />
        {visibleBars.map((b, i) => {
          const x = getX(i), zeroY = getY(0), histVal = b.macdHist ?? 0, hY = getY(histVal);
          return <line key={i} x1={x} y1={zeroY} x2={x} y2={hY} stroke={histVal >= 0 ? '#10b981' : '#ef4444'} strokeWidth="4" opacity="0.65" />;
        })}
        <path d={macdPath} fill="none" stroke="#22d3ee" strokeWidth="1.5" />
        <path d={signalPath} fill="none" stroke="#f59e0b" strokeWidth="1.5" />
        <text x={padding.left + 5} y={padding.top + 10} fill="#22d3ee" className="text-[8px] font-mono">MACD Line</text>
        <text x={padding.left + 65} y={padding.top + 10} fill="#f59e0b" className="text-[8px] font-mono">Signal Line</text>
      </svg>
    );
  };

  const renderSVGRSI = () => {
    if (bars.length < 5) return null;
    const width = 800, height = 90;
    const padding = { top: 10, right: 65, bottom: 10, left: 20 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const visibleBars = bars.slice(-40);
    const getX = (i: number) => padding.left + (i / (visibleBars.length - 1)) * chartWidth;
    const getY = (v: number) => padding.top + chartHeight - (v / 100) * chartHeight;

    let rsiPath = '';
    visibleBars.forEach((b, i) => {
      const x = getX(i), y = getY(b.rsi ?? 50);
      if (i === 0) rsiPath += `M ${x} ${y}`;
      else rsiPath += ` L ${x} ${y}`;
    });

    const oversoldY = getY(config.rsiOversold), overboughtY = getY(config.rsiOverbought);
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full select-none">
        <rect x={padding.left} y={overboughtY} width={chartWidth} height={oversoldY - overboughtY} fill="#1e1b4b" opacity="0.3" />
        <line x1={padding.left} y1={overboughtY} x2={width - padding.right} y2={overboughtY} stroke="#f43f5e" strokeWidth="1" strokeDasharray="3,3" opacity="0.7" />
        <line x1={padding.left} y1={oversoldY} x2={width - padding.right} y2={oversoldY} stroke="#38bdf8" strokeWidth="1" strokeDasharray="3,3" opacity="0.7" />
        <text x={width - padding.right + 5} y={overboughtY + 3} fill="#f43f5e" className="text-[8px] font-mono">OB ({config.rsiOverbought})</text>
        <text x={width - padding.right + 5} y={oversoldY + 3} fill="#38bdf8" className="text-[8px] font-mono">OS ({config.rsiOversold})</text>
        <path d={rsiPath} fill="none" stroke="#a855f7" strokeWidth="1.8" />
      </svg>
    );
  };

  const renderSVGPnL = () => {
    if (pnlHistory.length < 2) return null;
    const width = 800, height = 100;
    const padding = { top: 15, right: 65, bottom: 15, left: 20 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const visibleBars = bars.slice(-40);
    const visiblePnL = visibleBars.map(bar => {
      const h = pnlHistory.find(p => p.timestamp === bar.timestamp);
      return { time: bar.time, timestamp: bar.timestamp, pnlPercent: h ? h.pnlPercent : 0 };
    });

    const pnlPercents = visiblePnL.map(p => p.pnlPercent);
    const maxVal = Math.max(...pnlPercents.map(Math.abs), 1);
    const getX = (i: number) => padding.left + (i / (visibleBars.length - 1)) * chartWidth;
    const getY = (v: number) => padding.top + chartHeight / 2 - (v / maxVal) * (chartHeight / 2);

    let pnlLinePath = '', pnlAreaPath = '';
    visiblePnL.forEach((p, i) => {
      const x = getX(i), y = getY(p.pnlPercent);
      if (i === 0) { pnlLinePath += `M ${x} ${y}`; pnlAreaPath += `M ${x} ${getY(0)} L ${x} ${y}`; }
      else { pnlLinePath += ` L ${x} ${y}`; pnlAreaPath += ` L ${x} ${y}`; }
      if (i === visiblePnL.length - 1) pnlAreaPath += ` L ${x} ${getY(0)} Z`;
    });

    const lastPnL = pnlPercents[pnlPercents.length - 1] || 0;
    const isPositive = lastPnL >= 0;
    const strokeColor = isPositive ? '#10b981' : '#f43f5e';

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full select-none">
        <defs>
          <linearGradient id="pnl-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        {[-1, -0.5, 0, 0.5, 1].map((ratio, idx) => {
          const val = ratio * maxVal, y = getY(val);
          return (
            <g key={idx}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke={ratio === 0 ? '#475569' : '#1e293b'} strokeWidth={ratio === 0 ? '1.5' : '1'} strokeDasharray={ratio === 0 ? undefined : '2,4'} />
              <text x={width - padding.right + 5} y={y + 3} fill={ratio === 0 ? '#94a3b8' : '#64748b'} className="text-[9px] font-mono">
                {val >= 0 ? '+' : ''}{val.toFixed(2)}%
              </text>
            </g>
          );
        })}
        <path d={pnlAreaPath} fill="url(#pnl-grad)" />
        <path d={pnlLinePath} fill="none" stroke={strokeColor} strokeWidth="2" />
        {visiblePnL.length > 0 && (
          <g>
            <circle cx={getX(visiblePnL.length - 1)} cy={getY(lastPnL)} r="4" fill={strokeColor} />
            <circle cx={getX(visiblePnL.length - 1)} cy={getY(lastPnL)} r="7" fill={strokeColor} className="animate-ping opacity-30" />
          </g>
        )}
        <text x={padding.left + 5} y={padding.top + 8} fill={strokeColor} className="text-[9px] font-mono font-bold">
          누적 수익률: {lastPnL >= 0 ? '+' : ''}{lastPnL.toFixed(2)}%
        </text>
      </svg>
    );
  };

  const renderMiniPriceFlowList = () => {
    if (bars.length === 0) return <span className="text-xs text-slate-500 font-mono">데이터 로딩 중...</span>;
    const recentBars = [...bars].slice(-5).reverse();
    return (
      <div className="w-full grid grid-cols-5 gap-1.5 text-center text-[11px] font-mono">
        {recentBars.map((b, i, arr) => {
          const prevBar = arr[i + 1] || bars[bars.indexOf(b) - 1];
          const change = prevBar ? b.close - prevBar.close : 0;
          const changePercent = prevBar ? (change / prevBar.close) * 100 : 0;
          const isUp = change >= 0;
          return (
            <div key={b.timestamp} className="bg-slate-950 p-1.5 rounded border border-slate-900/60 flex flex-col justify-between h-[56px] min-w-0">
              <span className="text-[9px] text-slate-500 truncate block">{b.time}</span>
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
      default: return 'text-slate-300';
    }
  };

  const symbolLabel = config.symbol || '005930';
  const currencyUnit = '원';
  const lastBar = bars[bars.length - 1];

  return (
    <div className="space-y-6">
      {/* ── 전략 성과 대시보드 (3 카드) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
        {/* 최근 30일 승률 */}
        <div className="bg-slate-950/80 border border-slate-800/60 rounded-xl p-4 flex items-center justify-between shadow-lg relative overflow-hidden group">
          <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
            <Award className="h-20 w-20 text-amber-400" />
          </div>
          <div className="space-y-1 z-10">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">최근 30일 승률</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-mono font-black text-amber-400">{last30DaysWinRate.toFixed(1)}%</span>
              <span className="text-[10px] text-slate-500 font-semibold">({last30DaysWinTrades.length}승/{last30DaysTrades.length}회)</span>
            </div>
            <p className="text-[9px] text-slate-500 leading-none">최근 30일 내 청산 완료 기준</p>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Award className="h-4 w-4" />
          </div>
        </div>

        {/* 총 수익률 */}
        <div className="bg-slate-950/80 border border-slate-800/60 rounded-xl p-4 flex items-center justify-between shadow-lg relative overflow-hidden group">
          <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
            <TrendingUp className="h-20 w-20 text-emerald-400" />
          </div>
          <div className="space-y-1 z-10">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">총 수익률</span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl font-mono font-black ${portfolioPnL >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                {portfolioPnL >= 0 ? '+' : ''}{portfolioPnLPercent.toFixed(2)}%
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">({portfolioPnL >= 0 ? '+' : ''}{portfolioPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}원)</span>
            </div>
            <p className="text-[9px] text-slate-500 leading-none">시작 예수금 대비 현재 총 평가 자산</p>
          </div>
          <div className={`p-2.5 rounded-lg ${portfolioPnL >= 0 ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-500'}`}>
            {portfolioPnL >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
          </div>
        </div>

        {/* 최대 낙폭 (MDD) */}
        <div className="bg-slate-950/80 border border-slate-800/60 rounded-xl p-4 flex items-center justify-between shadow-lg relative overflow-hidden group">
          <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
            <ShieldAlert className="h-20 w-20 text-rose-400" />
          </div>
          <div className="space-y-1 z-10">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">최대 낙폭 (MDD)</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-mono font-black text-rose-400">-{portfolio.maxDrawdown.toFixed(2)}%</span>
              <span className="text-[10px] text-slate-500 font-semibold">고점 대비 최하락</span>
            </div>
            <p className="text-[9px] text-slate-500 leading-none">가상 자산 최대 손실폭</p>
          </div>
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <ShieldAlert className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* ── 메인 그리드 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-2xl">
        {/* 왼쪽: 컨트롤 + 포트폴리오 */}
        <div className="lg:col-span-1 flex flex-col space-y-4">
          {/* 헤더 + 데이터 소스 배지 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>실시간 자동매매 시뮬레이터</span>
              </h2>
              <span className="text-xs font-mono px-2 py-1 rounded bg-slate-800 text-slate-400">
                {symbolLabel} / {config.timeframe.toUpperCase()}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 items-center mb-4">
              {isLoadingData ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] font-medium text-blue-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                  실시간 데이터 로딩 중...
                </span>
              ) : isLive ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  LIVE · 네이버증권 (5초 폴링)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-medium text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  유기적 가상 시뮬레이션 모드
                </span>
              )}
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                currentSignalClass === '매수후보' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' :
                currentSignalClass === '관심'    ? 'bg-blue-500/15 text-blue-400 border-blue-500/40' :
                currentSignalClass === '위험'    ? 'bg-rose-500/15 text-rose-400 border-rose-500/40' :
                'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  currentSignalClass === '매수후보' ? 'bg-emerald-400 animate-pulse' :
                  currentSignalClass === '관심'    ? 'bg-blue-400' :
                  currentSignalClass === '위험'    ? 'bg-rose-400 animate-pulse' :
                  'bg-slate-500'
                }`} />
                {currentSignalClass}
              </span>
            </div>
          </div>

          {/* 시작 예수금 설정 */}
          <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-3">
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 flex justify-between items-center">
              <span>시작 예수금 (Initial Cash)</span>
              <span className="text-[10px] text-emerald-400 font-mono">단위: 원</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={startingCashInput}
                onChange={e => setStartingCashInput(e.target.value.replace(/[^0-9]/g, ''))}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="금액 입력"
              />
              <button
                onClick={() => {
                  const num = parseFloat(startingCashInput);
                  if (!isNaN(num) && num > 0) {
                    setStartingCash(num);
                    startingCashRef.current = num;
                    setTimeout(() => loadRealData(config.symbol), 50);
                  }
                }}
                className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                적용
              </button>
            </div>
            <div className="flex gap-1.5 mt-2">
              {[1000000, 5000000, 10000000, 50000000].map(preset => (
                <button
                  key={preset}
                  onClick={() => {
                    setStartingCashInput(preset.toString());
                    setStartingCash(preset);
                    startingCashRef.current = preset;
                    setTimeout(() => loadRealData(config.symbol), 50);
                  }}
                  className={`flex-1 text-[10px] font-mono py-1 rounded border transition cursor-pointer text-center ${
                    startingCash === preset
                      ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/5 font-bold'
                      : 'border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  {`${(preset / 1000000).toLocaleString()}백만`}
                </button>
              ))}
            </div>
          </div>

          {/* 컨트롤 버튼 */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
                isPlaying ? 'bg-amber-600 text-slate-950 hover:bg-amber-500' : 'bg-emerald-600 text-white hover:bg-emerald-500'
              }`}
            >
              {isPlaying ? <><Pause className="h-4 w-4" /><span>일시정지</span></> : <><Play className="h-4 w-4" /><span>시작하기</span></>}
            </button>
            <button
              onClick={() => setSimulationSpeed(prev => prev === 2000 ? 1000 : prev === 1000 ? 400 : 2000)}
              className="flex items-center justify-center space-x-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
            >
              <span>배속: {simulationSpeed === 2000 ? '1x' : simulationSpeed === 1000 ? '2x' : '5x'}</span>
            </button>
            <button
              onClick={() => loadRealData(config.symbol)}
              disabled={isLoadingData}
              className="flex items-center justify-center space-x-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
              <span>{isLoadingData ? '로딩중' : '초기화'}</span>
            </button>
          </div>

          {/* 포트폴리오 메트릭 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-slate-400 font-medium flex items-center gap-1">
                  <Wallet className="h-3 w-3 text-slate-400" /> 총 자산 가치
                </p>
                <p className="text-xl font-mono font-bold text-slate-100 mt-1">
                  {portfolio.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-xs text-slate-400">{currencyUnit}</span>
                </p>
              </div>
              <span className={`text-xs font-mono font-bold px-2 py-1 rounded-lg ${portfolioPnL >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                {portfolioPnL >= 0 ? '+' : ''}{portfolioPnLPercent.toFixed(2)}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-3 text-xs">
              <div>
                <p className="text-slate-500 mb-1">예수금 (Cash)</p>
                <p className="font-mono text-slate-300 font-semibold">{portfolio.cash.toLocaleString(undefined, { maximumFractionDigits: 0 })} {currencyUnit}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">현재가</p>
                <p className="font-mono text-emerald-400 font-semibold">{currentPrice ? currentPrice.toLocaleString() : '-'} {currencyUnit}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">보유 수량</p>
                <p className="font-mono text-slate-300 font-semibold">{portfolio.holdings.toFixed(0)} 주</p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">보유 평단가</p>
                <p className="font-mono text-slate-300 font-semibold">
                  {portfolio.avgBuyPrice > 0 ? `${portfolio.avgBuyPrice.toLocaleString()} ${currencyUnit}` : '-'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-3 text-xs">
              <div>
                <p className="text-slate-500 mb-1">승률 (Win Rate)</p>
                <p className="font-mono text-amber-400 font-bold">{winRate.toFixed(1)}% <span className="text-slate-500 text-[10px] font-normal">({winTrades.length}/{completedTrades.length})</span></p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">최대 낙폭 (MDD)</p>
                <p className="font-mono text-rose-400 font-semibold">-{portfolio.maxDrawdown.toFixed(2)}%</p>
              </div>
            </div>
          </div>

          {/* 최근 5봉 가격 흐름 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                <span>최근 5봉 가격 흐름</span>
              </span>
              <span className="font-mono text-emerald-400 font-bold text-[11px]">
                {currentPrice ? `${currentPrice.toLocaleString()} 원` : '-'}
              </span>
            </div>
            <div className="bg-slate-950/40 rounded-lg p-2 border border-slate-900/40">
              {renderMiniPriceFlowList()}
            </div>
          </div>

          {/* 이동평균선 현재값 패널 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
                <span>실시간 이동평균선 (MA)</span>
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">단위: 원</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-950/80 border border-slate-800/40 rounded-lg p-2.5">
                <span className="text-[10px] font-bold text-amber-400 block mb-1 flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> MA 20
                </span>
                <span className="text-xs font-mono font-bold text-slate-200">
                  {lastBar?.ma20 ? `${lastBar.ma20.toLocaleString()}` : '-'}
                </span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800/40 rounded-lg p-2.5">
                <span className="text-[10px] font-bold text-sky-400 block mb-1 flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span> MA 60
                </span>
                <span className="text-xs font-mono font-bold text-slate-200">
                  {lastBar?.ma60 ? `${lastBar.ma60.toLocaleString()}` : '-'}
                </span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800/40 rounded-lg p-2.5">
                <span className="text-[10px] font-bold text-pink-400 block mb-1 flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1 border-t border-dashed border-pink-500"></span> MA 120
                </span>
                <span className="text-xs font-mono font-bold text-slate-200">
                  {lastBar?.ma120 ? `${lastBar.ma120.toLocaleString()}` : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* 리스크 안전 조건 */}
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3.5 space-y-2 text-xs">
            <p className="font-semibold text-slate-300 flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-emerald-400" /> 적용된 리스크 안전 조건
            </p>
            <ul className="space-y-1 text-slate-400 font-mono">
              <li className="flex items-center justify-between">
                <span>• 신호 분류:</span>
                <span className="text-slate-200">5조건 점수제 (≥5점)</span>
              </li>
              <li className="flex items-center justify-between">
                <span>• RSI 과매도/과열:</span>
                <span className="text-blue-400">≤{config.rsiOversold} / ≥{config.rsiOverbought}</span>
              </li>
              <li className="flex items-center justify-between">
                <span>• MA20 필터:</span>
                <span className="text-amber-400">종가 {'>'} MA20</span>
              </li>
              <li className="flex items-center justify-between">
                <span>• 거래량 필터:</span>
                <span className="text-purple-400">{config.volumeMAPeriod}봉 평균 초과</span>
              </li>
              <li className="flex items-center justify-between">
                <span>• 익절 / 손절:</span>
                <span className="text-emerald-400">+{config.takeProfit}% / <span className="text-rose-400">-{config.stopLoss}%</span></span>
              </li>
            </ul>
          </div>
        </div>

        {/* 오른쪽: 차트 + 터미널 */}
        <div className="lg:col-span-2 flex flex-col space-y-6">
          {/* 차트 패널 */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
              <span className="text-xs font-semibold text-slate-400">차트 모니터링 (최근 40봉)</span>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
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
              <div className="bg-slate-950/80 rounded-lg p-2 h-[220px] border border-slate-900/60 flex items-center justify-center">
                {renderSVGChart()}
              </div>
              <div className="bg-slate-950/80 rounded-lg p-2 h-[100px] border border-slate-900/60 flex items-center justify-center">
                {renderSVGMACD()}
              </div>
              <div className="bg-slate-950/80 rounded-lg p-2 h-[80px] border border-slate-900/60 flex items-center justify-center">
                {renderSVGRSI()}
              </div>
              <div className="bg-slate-950/80 rounded-lg p-2 h-[90px] border border-slate-900/60 flex items-center justify-center">
                {renderSVGPnL()}
              </div>
            </div>
          </div>

          {/* 터미널 로그 */}
          <div className="flex flex-col h-[180px] bg-black border border-slate-900 rounded-xl overflow-hidden font-mono text-[11px] leading-relaxed shadow-inner">
            <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-950 border-b border-slate-900 text-slate-400 select-none">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-[10px] ml-2 text-slate-500 font-medium">TRADING SYSTEM SHELL</span>
              </div>
              <span className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-500">
                {isLive ? 'LIVE MODE' : 'SIM MODE'}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1 select-text">
              {logs.map(log => (
                <div key={log.id} className="flex hover:bg-slate-900/40 px-1 rounded transition-colors duration-150">
                  <span className="text-slate-600 mr-2">[{log.timestamp}]</span>
                  <span className={getLogTypeColor(log.type)}>{log.message}</span>
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
