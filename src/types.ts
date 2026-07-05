export interface BotConfig {
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  rsiLookback: number;
  maPeriod: number;          // e.g. 20
  volumeMAPeriod: number;    // e.g. 20
  volumeThreshold?: number;  // 거래량 MA 배수 (MACDRSI 기본값 1.5)
  stopLoss: number;
  takeProfit: number;
  tradeSize: number;
  timeframe: '1h' | '4h';
  marketType: 'stock';
  symbol: string;
}

export type SignalClass = '매수후보' | '관심' | '관망' | '위험';

export interface MarketBar {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  ma?: number;             // configurable period SMA (for 5-condition scoring)
  volumeMA?: number;       // volume moving average
  ma20?: number;           // 20-day SMA
  ma60?: number;           // 60-day SMA
  ma120?: number;          // 120-day SMA
  hma100?: number;         // 100-period Hull Moving Average (Ross Cameron trend filter)
  // ── MACDRSI Enhanced (panzmoravylab/MACDRSI_Indicator 기준) ──────────────
  signalStrength?: number; // 종합 신호 강도 -100~+100 (MACD 50% + RSI 30% + Volume 20%)
  trendState?: 'strong_up' | 'weak_up' | 'neutral' | 'weak_down' | 'strong_down';
  bullishDiv?: boolean;    // 상승 다이버전스 (가격 신저점 + RSI 고저점)
  bearishDiv?: boolean;    // 하락 다이버전스 (가격 신고점 + RSI 저고점)
}

export interface Trade {
  id: string;
  type: 'BUY' | 'SELL' | 'STOP_LOSS' | 'TAKE_PROFIT';
  price: number;
  quantity: number;
  amount: number;
  timestamp: number;
  timeString: string;
  balanceAfter: number;
  profitPercent?: number;
  profitAmount?: number;
}

export interface SimulatedPortfolio {
  cash: number;
  holdings: number; // asset amount
  avgBuyPrice: number;
  totalValue: number;
  peakValue: number;
  maxDrawdown: number;
  trades: Trade[];
}

export interface LogMessage {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'buy' | 'sell';
  message: string;
}
