import React, { useState } from 'react';
import { Play, TrendingUp, AlertTriangle, ShieldCheck, ListFilter, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { BotConfig, MarketBar, SimulatedPortfolio, Trade } from '../types';
import { generateMockHistory, computeIndicators } from '../utils';

interface Props {
  config: BotConfig;
}

export default function BacktestPanel({ config }: Props) {
  const [candleCount, setCandleCount] = useState<number>(500);
  const [isTesting, setIsTesting] = useState(false);
  const [results, setResults] = useState<{
    portfolio: SimulatedPortfolio;
    winRate: number;
    totalPnLPercent: number;
    completedCount: number;
    winCount: number;
    lossCount: number;
    mdd: number;
    initialBalance: number;
    equityHistory: { time: string; value: number; drawdown: number; price: number }[];
  } | null>(null);

  const runBacktest = () => {
    setIsTesting(true);
    
    // Simulate a brief delay to feel realistic and responsive
    setTimeout(() => {
      const initialBalance = 1000000; // 100만원
      let cash = initialBalance;
      let holdings = 0;
      let avgBuyPrice = 0;
      let peakValue = initialBalance;
      let maxDrawdown = 0;
      const trades: Trade[] = [];
      const equityHistory: { time: string; value: number; drawdown: number; price: number }[] = [];

      // Generate historical candles
      const testBars = generateMockHistory(candleCount, config);

      // Loop through candles starting from index 30 to allow indicator stability
      for (let i = 30; i < testBars.length; i++) {
        const bar = testBars[i];
        const currentPrice = bar.close;

        // 1. Check Stop Loss / Take Profit
        if (holdings > 0 && avgBuyPrice > 0) {
          const pnlPercent = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;

          // A. Stop Loss
          if (pnlPercent <= -config.stopLoss) {
            const sellAmount = holdings * currentPrice;
            const profitAmt = sellAmount - (holdings * avgBuyPrice);
            cash += sellAmount;

            trades.push({
              id: Math.random().toString(36).substring(2, 9),
              type: 'STOP_LOSS',
              price: currentPrice,
              quantity: holdings,
              amount: sellAmount,
              timestamp: bar.timestamp,
              timeString: bar.time,
              balanceAfter: cash,
              profitPercent: pnlPercent,
              profitAmount: profitAmt
            });

            holdings = 0;
            avgBuyPrice = 0;
            continue;
          }

          // B. Take Profit
          if (pnlPercent >= config.takeProfit) {
            const sellAmount = holdings * currentPrice;
            const profitAmt = sellAmount - (holdings * avgBuyPrice);
            cash += sellAmount;

            trades.push({
              id: Math.random().toString(36).substring(2, 9),
              type: 'TAKE_PROFIT',
              price: currentPrice,
              quantity: holdings,
              amount: sellAmount,
              timestamp: bar.timestamp,
              timeString: bar.time,
              balanceAfter: cash,
              profitPercent: pnlPercent,
              profitAmount: profitAmt
            });

            holdings = 0;
            avgBuyPrice = 0;
            continue;
          }
        }

        // 2. Technical Indicator evaluation — 5-condition scoring
        if (i < 2) continue;

        const currBar = testBars[i];
        const prevBar = testBars[i - 1];

        const currRsi  = currBar.rsi        ?? 50;
        const prevRsi  = prevBar.rsi        ?? 50;
        const currMacd = currBar.macd       ?? 0;
        const currSig  = currBar.macdSignal ?? 0;
        const prevMacd = prevBar.macd       ?? 0;
        const prevSig  = prevBar.macdSignal ?? 0;
        const currHist = currBar.macdHist   ?? 0;
        const prevHist = prevBar.macdHist   ?? 0;

        // ① MACD 골든크로스 / 데드크로스
        const isGoldenCross = prevMacd <= prevSig && currMacd > currSig;
        const isDeadCross   = prevMacd >= prevSig && currMacd < currSig;

        // ② MACD 히스토그램 증가
        const histIncreasing = currHist > prevHist;

        // ③ RSI 30~50 반등 또는 50선 상향 돌파
        const rsiReboundFromOversold = currRsi > config.rsiOversold && currRsi <= 50 && currRsi > prevRsi;
        const rsiCross50 = prevRsi < 50 && currRsi >= 50;
        const rsiCondition = rsiReboundFromOversold || rsiCross50;

        // ④ 가격이 이동평균선 위
        const aboveMA = currBar.ma != null && currentPrice > currBar.ma;

        // ⑤ 거래량 평균 초과
        const volumeAboveAvg = currBar.volumeMA != null && currBar.volume > currBar.volumeMA;

        // 점수 합산 (max 7)
        let buyScore = 0;
        if (isGoldenCross)  buyScore += 2;
        if (histIncreasing) buyScore += 1;
        if (rsiCondition)   buyScore += 2;
        if (aboveMA)        buyScore += 1;
        if (volumeAboveAvg) buyScore += 1;

        // 매도 위험 판단
        const lookbackSlice = testBars.slice(Math.max(0, i - config.rsiLookback + 1), i + 1);
        const wasOverbought = lookbackSlice.some(b => (b.rsi ?? 50) >= config.rsiOverbought);

        // A. BUY — 매수후보 (score >= 5)
        if (buyScore >= 5 && holdings === 0) {
          const buyBudget = cash * (config.tradeSize / 100);
          const qty = buyBudget / currentPrice;

          cash -= buyBudget;
          holdings = qty;
          avgBuyPrice = currentPrice;

          trades.push({
            id: Math.random().toString(36).substring(2, 9),
            type: 'BUY',
            price: currentPrice,
            quantity: qty,
            amount: buyBudget,
            timestamp: bar.timestamp,
            timeString: bar.time,
            balanceAfter: cash
          });
        }
        // B. SELL — 위험 (과열 + 데드크로스)
        else if (wasOverbought && isDeadCross && holdings > 0) {
          const sellAmount = holdings * currentPrice;
          const profitAmt  = sellAmount - (holdings * avgBuyPrice);
          const profitPct  = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;
          cash += sellAmount;

          trades.push({
            id: Math.random().toString(36).substring(2, 9),
            type: 'SELL',
            price: currentPrice,
            quantity: holdings,
            amount: sellAmount,
            timestamp: bar.timestamp,
            timeString: bar.time,
            balanceAfter: cash,
            profitPercent: profitPct,
            profitAmount: profitAmt
          });

          holdings = 0;
          avgBuyPrice = 0;
        }

        // Recalculate drawdown
        const currentTotal = cash + (holdings * currentPrice);
        peakValue = Math.max(peakValue, currentTotal);
        const drawdown = ((peakValue - currentTotal) / peakValue) * 100;
        maxDrawdown = Math.max(maxDrawdown, drawdown);

        equityHistory.push({
          time: bar.time,
          value: currentTotal,
          drawdown: drawdown,
          price: currentPrice
        });
      }

      // Close out any final open positions to find end assets
      const lastBar = testBars[testBars.length - 1];
      let finalCash = cash;
      if (holdings > 0) {
        const sellAmount = holdings * lastBar.close;
        const profitAmt = sellAmount - (holdings * avgBuyPrice);
        const profitPct = ((lastBar.close - avgBuyPrice) / avgBuyPrice) * 100;
        finalCash += sellAmount;
        
        trades.push({
          id: 'backtest-final-close',
          type: 'SELL',
          price: lastBar.close,
          quantity: holdings,
          amount: sellAmount,
          timestamp: lastBar.timestamp,
          timeString: lastBar.time,
          balanceAfter: finalCash,
          profitPercent: profitPct,
          profitAmount: profitAmt
        });
        holdings = 0;
      }

      const totalValue = finalCash;
      const completed = trades.filter(t => t.type !== 'BUY');
      const wins = completed.filter(t => (t.profitPercent ?? 0) > 0);
      const losses = completed.filter(t => (t.profitPercent ?? 0) <= 0);
      const totalPnLPercent = ((totalValue - initialBalance) / initialBalance) * 100;
      const winRate = completed.length > 0 ? (wins.length / completed.length) * 100 : 0;

      setResults({
        portfolio: {
          cash: finalCash,
          holdings: 0,
          avgBuyPrice: 0,
          totalValue,
          peakValue,
          maxDrawdown,
          trades
        },
        winRate,
        totalPnLPercent,
        completedCount: completed.length,
        winCount: wins.length,
        lossCount: losses.length,
        mdd: maxDrawdown,
        initialBalance,
        equityHistory
      });
      setIsTesting(false);
    }, 900);
  };

  const renderEquityChart = () => {
    if (!results || results.equityHistory.length < 5) return null;

    const width = 800;
    const height = 180;
    const padding = { top: 15, right: 65, bottom: 20, left: 15 };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const history = results.equityHistory;
    
    // Subsample if there are too many data points (performance optimization)
    const stride = Math.max(1, Math.floor(history.length / 200));
    const sampled = [];
    for (let i = 0; i < history.length; i += stride) {
      sampled.push(history[i]);
    }
    if (sampled[sampled.length - 1] !== history[history.length - 1]) {
      sampled.push(history[history.length - 1]);
    }

    const values = sampled.map(h => h.value);
    const minVal = Math.min(...values) * 0.98;
    const maxVal = Math.max(...values) * 1.02;

    const getX = (index: number) => padding.left + (index / (sampled.length - 1)) * chartWidth;
    const getY = (val: number) => padding.top + chartHeight - ((val - minVal) / (maxVal - minVal)) * chartHeight;

    // Line Path for Equity
    let equityPath = '';
    sampled.forEach((h, i) => {
      const x = getX(i);
      const y = getY(h.value);
      if (i === 0) equityPath += `M ${x} ${y}`;
      else equityPath += ` L ${x} ${y}`;
    });

    // Filled area under path
    const fillPath = `${equityPath} L ${getX(sampled.length - 1)} ${padding.top + chartHeight} L ${getX(0)} ${padding.top + chartHeight} Z`;

    // Drawdown Area (Top Shaded)
    let drawdownPath = `M ${getX(0)} ${padding.top}`;
    sampled.forEach((h, i) => {
      const x = getX(i);
      const maxDD = results.mdd || 1;
      const y = padding.top + (h.drawdown / maxDD) * chartHeight * 0.4; // occupy top 40%
      drawdownPath += ` L ${x} ${y}`;
    });
    drawdownPath += ` L ${getX(sampled.length - 1)} ${padding.top} Z`;

    return (
      <div className="bg-slate-950 rounded-xl p-4 border border-slate-900">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">누적 자산 변화 곡선 (Equity Curve) & 실시간 낙폭 (Drawdown)</span>
          <div className="flex space-x-3 text-[9px] font-mono">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500/10 border border-emerald-500"></span>자산 가치</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-500/15 border border-rose-500/40"></span>실시간 낙폭 (Drawdown)</span>
          </div>
        </div>
        <div className="h-[140px] w-full flex items-center justify-center">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full text-slate-400 font-sans select-none">
            {/* Y Gridlines and labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
              const valAtRatio = maxVal - ratio * (maxVal - minVal);
              const y = getY(valAtRatio);
              return (
                <g key={idx}>
                  <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#1e293b" strokeWidth="1" strokeDasharray="2,4" />
                  <text x={width - padding.right + 5} y={y + 3} fill="#64748b" className="text-[9px] font-mono">
                    {valAtRatio.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </text>
                </g>
              );
            })}

            {/* Drawdown Area (Top Shaded) */}
            <path d={drawdownPath} fill="#f43f5e" fillOpacity="0.1" stroke="#f43f5e" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="2,2" />

            {/* Equity Area and Line */}
            <path d={fillPath} fill="url(#backtestEquityGrad)" opacity="0.06" />
            <path d={equityPath} fill="none" stroke="#10b981" strokeWidth="2" className="drop-shadow-[0_0_4px_rgba(16,185,129,0.2)]" />

            {/* X-axis labels (start and end times) */}
            <text x={padding.left} y={height - 2} fill="#475569" className="text-[9px] font-mono" textAnchor="start">
              {history[0].time}
            </text>
            <text x={width - padding.right} y={height - 2} fill="#475569" className="text-[9px] font-mono" textAnchor="end">
              {history[history.length - 1].time}
            </text>

            <defs>
              <linearGradient id="backtestEquityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    );
  };

  const currencyUnit = '원';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
      {/* Run bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-base font-bold text-slate-100">신속 과거 데이터 시뮬레이션 (Backtesting)</h2>
          <p className="text-xs text-slate-400 mt-1">
            설정된 MACD 및 RSI 지표 변수와 리스크 관리 규칙을 활용해 {candleCount}봉의 가상 데이터를 즉시 돌려봅니다.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={candleCount}
            onChange={(e) => setCandleCount(Number(e.target.value))}
            className="bg-slate-950 border border-slate-800 rounded-xl text-slate-300 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value={300}>300 봉 (약 12일)</option>
            <option value={500}>500 봉 (약 20일)</option>
            <option value={1000}>1000 봉 (약 41일)</option>
            <option value={2190}>2190 봉 (약 1년, 4시간봉 기준)</option>
            <option value={8760}>8760 봉 (약 1년, 1시간봉 기준)</option>
          </select>
          <button
            onClick={runBacktest}
            disabled={isTesting}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer"
          >
            <Play className={`h-4 w-4 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? '백테스트 분석 중...' : '백테스트 실행'}</span>
          </button>
        </div>
      </div>

      {/* Results panel */}
      {results ? (
        <div className="space-y-6">
          {/* Dashboard Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <p className="text-[11px] text-slate-500 font-medium">최종 자산 가치</p>
              <p className="text-lg font-mono font-bold text-slate-100 mt-1">
                {results.portfolio.totalValue.toLocaleString(undefined, { maximumFractionDigits: 1 })}{' '}
                <span className="text-xs text-slate-500">{currencyUnit}</span>
              </p>
              <span className={`text-[10px] font-mono font-bold flex items-center gap-0.5 mt-2 ${results.totalPnLPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {results.totalPnLPercent >= 0 ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {results.totalPnLPercent >= 0 ? '+' : ''}
                {results.totalPnLPercent.toFixed(2)}% 수익률
              </span>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <p className="text-[11px] text-slate-500 font-medium">총 거래 횟수</p>
              <p className="text-lg font-mono font-bold text-slate-100 mt-1">
                {results.completedCount} <span className="text-xs text-slate-500">회</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-2">
                포지션 종료 기준 (총 {results.portfolio.trades.length}건 거래)
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <p className="text-[11px] text-slate-500 font-medium">승률 (Win Rate)</p>
              <p className="text-lg font-mono font-bold text-amber-400 mt-1">
                {results.winRate.toFixed(1)}%
              </p>
              <p className="text-[10px] text-slate-400 mt-2 flex items-center justify-between">
                <span>성공: {results.winCount}회</span>
                <span>실패: {results.lossCount}회</span>
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <p className="text-[11px] text-slate-500 font-medium">최대 낙폭 (Max Drawdown)</p>
              <p className="text-lg font-mono font-bold text-rose-400 mt-1">
                -{results.mdd.toFixed(2)}%
              </p>
              <p className="text-[10px] text-slate-400 mt-2">
                역사적 최고 자산 가치 대비 낙폭
              </p>
            </div>
          </div>

          {renderEquityChart()}

          {/* Trade ledger table */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-1.5">
              <ListFilter className="h-4 w-4 text-emerald-400" /> 상세 매매 체결 일지 (최근 완료순)
            </h3>
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden max-h-[220px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-medium font-mono">
                    <th className="p-3">시간</th>
                    <th className="p-3">유형</th>
                    <th className="p-3 text-right">체결 가격</th>
                    <th className="p-3 text-right">수량</th>
                    <th className="p-3 text-right">실현 손익</th>
                    <th className="p-3 text-right">자산 잔고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 font-mono">
                  {results.portfolio.trades.slice().reverse().map((t, idx) => {
                    const isBuy = t.type === 'BUY';
                    const hasProfit = (t.profitPercent ?? 0) > 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-900/40 text-slate-300">
                        <td className="p-3 text-slate-500 text-[10px]">{t.timeString}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' :
                            t.type === 'STOP_LOSS' ? 'bg-rose-500/10 text-rose-400' :
                            t.type === 'TAKE_PROFIT' ? 'bg-indigo-500/10 text-indigo-400' :
                            'bg-amber-500/10 text-amber-400'
                          }`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold">{t.price.toLocaleString()}</td>
                        <td className="p-3 text-right text-slate-400">{t.quantity.toFixed(4)}</td>
                        <td className={`p-3 text-right font-bold ${isBuy ? 'text-slate-500' : hasProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isBuy ? '-' : `${t.profitPercent! >= 0 ? '+' : ''}${t.profitPercent!.toFixed(1)}% (${t.profitAmount!.toLocaleString(undefined, { maximumFractionDigits: 0 })})`}
                        </td>
                        <td className="p-3 text-right text-slate-400">{t.balanceAfter.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      </tr>
                    );
                  })}
                  {results.portfolio.trades.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 font-sans">
                        테스트 기간 동안 조건에 부합하는 거래 건이 발생하지 않았습니다. 기술적 변수를 조정해 보십시오.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-950/50 border border-slate-800 border-dashed rounded-xl p-8 text-center text-slate-400 text-xs">
          <Play className="h-8 w-8 text-slate-600 mx-auto mb-2.5" />
          <p className="font-medium text-slate-300">백테스트 결과가 존재하지 않습니다</p>
          <p className="text-slate-500 mt-1">
            상단 버튼을 눌러 과거 시장 가상 흐름을 가속화해 MACD 및 RSI 크로스오버 승률 및 MDD 수익률을 예측해 보세요.
          </p>
        </div>
      )}
    </div>
  );
}
