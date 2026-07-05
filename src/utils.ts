import { BotConfig, MarketBar } from './types';

// ── Moving Average calculators ────────────────────────────────────────────────

export function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  if (data.length === 0) return ema;
  const k = 2 / (period + 1);
  let prev = data[0];
  ema.push(prev);
  for (let i = 1; i < data.length; i++) {
    prev = data[i] * k + prev * (1 - k);
    ema.push(prev);
  }
  return ema;
}

// WMA (Weighted Moving Average) — used by HMA
export function calculateWMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const denom = (period * (period + 1)) / 2;
  for (let i = 0; i < data.length; i++) {
    const start  = Math.max(0, i - period + 1);
    const slice  = data.slice(start, i + 1);
    const p      = slice.length;
    const wDenom = (p * (p + 1)) / 2;
    const val    = slice.reduce((sum, v, j) => sum + v * (j + 1), 0) / (p < period ? wDenom : denom);
    result.push(val);
  }
  return result;
}

// HMA (Hull Moving Average): HMA(n) = WMA(2·WMA(n/2) − WMA(n), √n)
// 모멘텀 스코프의 기준선으로 사용 (MACD보다 빠른 추세 파악)
export function calculateHMA(data: number[], period: number): number[] {
  const half   = Math.max(2, Math.floor(period / 2));
  const sqrtP  = Math.max(2, Math.floor(Math.sqrt(period)));
  const wmaH   = calculateWMA(data, half);
  const wmaF   = calculateWMA(data, period);
  const diff   = wmaH.map((v, i) => 2 * v - wmaF[i]);
  return calculateWMA(diff, sqrtP);
}

// ── Signal helpers ────────────────────────────────────────────────────────────

// 하락 다이버전스 감지: 가격 고점 상승 + RSI 고점 하락
// MACDRSI_Indicator 기준: lookback 20봉
// Ross Cameron: 추세 전환 경고 후 MACD 골든크로스에서 2차 진입
export function detectBearishDivergence(bars: MarketBar[], lookback = 20): boolean {
  if (bars.length < lookback + 2) return false;
  const recent = bars.slice(-lookback);

  const highs: { price: number; rsi: number }[] = [];
  for (let i = 1; i < recent.length - 1; i++) {
    const b = recent[i];
    if (b.high > recent[i - 1].high && b.high > recent[i + 1].high) {
      highs.push({ price: b.high, rsi: b.rsi ?? 50 });
    }
  }
  if (highs.length < 2) return false;
  const [first, second] = highs.slice(-2);
  // 가격은 신고점, RSI는 저고점 → 하락 다이버전스
  return second.price > first.price * 1.001 && second.rsi < first.rsi - 2;
}

// 상승 다이버전스 감지: 가격 저점 하락 + RSI 저점 상승
// MACDRSI_Indicator: 매수 시그널 강화 조건
export function detectBullishDivergence(bars: MarketBar[], lookback = 20): boolean {
  if (bars.length < lookback + 2) return false;
  const recent = bars.slice(-lookback);

  const lows: { price: number; rsi: number }[] = [];
  for (let i = 1; i < recent.length - 1; i++) {
    const b = recent[i];
    if (b.low < recent[i - 1].low && b.low < recent[i + 1].low) {
      lows.push({ price: b.low, rsi: b.rsi ?? 50 });
    }
  }
  if (lows.length < 2) return false;
  const [first, second] = lows.slice(-2);
  // 가격은 신저점, RSI는 고저점 → 상승 다이버전스
  return second.price < first.price * 0.999 && second.rsi > first.rsi + 2;
}

// 직근 스윙저점 — Ross Cameron 손절가 기준
export function calcSwingLow(bars: MarketBar[], lookback = 10): number {
  const recent = bars.slice(-lookback);
  return Math.min(...recent.map(b => b.low));
}

// ── Full indicator calculation ────────────────────────────────────────────────
export function computeIndicators(bars: MarketBar[], config: BotConfig): MarketBar[] {
  if (bars.length === 0) return [];

  const closes  = bars.map(b => b.close);
  const volumes = bars.map(b => b.volume);
  const n       = bars.length;

  // 1. RSI (Wilder's smoothing)
  const rsi: number[] = new Array(n).fill(50);
  if (n > config.rsiPeriod) {
    const deltas = closes.slice(1).map((c, i) => c - closes[i]);
    let avgGain = 0, avgLoss = 0;
    for (let i = 0; i < config.rsiPeriod; i++) {
      const d = deltas[i];
      if (d > 0) avgGain += d; else avgLoss -= d;
    }
    avgGain /= config.rsiPeriod;
    avgLoss /= config.rsiPeriod;
    rsi[config.rsiPeriod] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    for (let i = config.rsiPeriod + 1; i < n; i++) {
      const d    = deltas[i - 1];
      const gain = d > 0 ? d : 0;
      const loss = d < 0 ? -d : 0;
      avgGain    = (avgGain * (config.rsiPeriod - 1) + gain) / config.rsiPeriod;
      avgLoss    = (avgLoss * (config.rsiPeriod - 1) + loss) / config.rsiPeriod;
      rsi[i]     = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
  }

  // 2. MACD (EMA 기반)
  const emaFast   = calculateEMA(closes, config.macdFast);
  const emaSlow   = calculateEMA(closes, config.macdSlow);
  const macdLine  = emaFast.map((v, i) => v - emaSlow[i]);
  const macdSig   = calculateEMA(macdLine, config.macdSignal);
  const macdHist  = macdLine.map((v, i) => v - macdSig[i]);

  // 3. 설정 MA (5-조건 스코어용)
  const ma: (number | null)[] = new Array(n).fill(null);
  for (let i = config.maPeriod - 1; i < n; i++) {
    const sl = closes.slice(i - config.maPeriod + 1, i + 1);
    ma[i]    = sl.reduce((a, b) => a + b, 0) / config.maPeriod;
  }

  // 4. 거래량 MA
  const volMA: (number | null)[] = new Array(n).fill(null);
  for (let i = config.volumeMAPeriod - 1; i < n; i++) {
    const sl = volumes.slice(i - config.volumeMAPeriod + 1, i + 1);
    volMA[i] = sl.reduce((a, b) => a + b, 0) / config.volumeMAPeriod;
  }

  // 5. 고정 SMA: 20 / 60 / 120
  const calcSMA = (data: number[], period: number): number[] =>
    data.map((_, i) => {
      const sl = data.slice(Math.max(0, i - period + 1), i + 1);
      return parseFloat((sl.reduce((a, b) => a + b, 0) / sl.length).toFixed(1));
    });
  const ma20arr  = calcSMA(closes, 20);
  const ma60arr  = calcSMA(closes, 60);
  const ma120arr = calcSMA(closes, 120);

  // 6. HMA 100 — 모멘텀 스코프 기준선 (추세 방향 필터)
  const hma100arr = calculateHMA(closes, 100);

  // 1차 패스: 기본 지표 계산
  const enriched: MarketBar[] = bars.map((bar, i) => ({
    ...bar,
    rsi:        parseFloat(rsi[i].toFixed(2)),
    macd:       parseFloat(macdLine[i].toFixed(4)),
    macdSignal: parseFloat(macdSig[i].toFixed(4)),
    macdHist:   parseFloat(macdHist[i].toFixed(4)),
    ma:         ma[i] !== null ? parseFloat((ma[i] as number).toFixed(2)) : undefined,
    volumeMA:   volMA[i] !== null ? Math.round(volMA[i] as number) : undefined,
    ma20:       ma20arr[i],
    ma60:       ma60arr[i],
    ma120:      ma120arr[i],
    hma100:     parseFloat(hma100arr[i].toFixed(2)),
  }));

  // 2차 패스: 신호 강도 / 추세 상태 / 다이버전스 (MACDRSI_Indicator 기준)
  // 가중치: MACD 50% + RSI 30% + Volume 20%
  const volThreshold = config.volumeThreshold ?? 1.5;

  return enriched.map((bar, i) => {
    const prev = i > 0 ? enriched[i - 1] : null;

    // ── MACD 컴포넌트 (-50 ~ +50) ─────────────────────────────────────────
    let macdComp = 0;
    if (bar.macd !== undefined && bar.macdSignal !== undefined && bar.macdHist !== undefined) {
      macdComp += bar.macd > bar.macdSignal ? 25 : bar.macd < bar.macdSignal ? -25 : 0;
      macdComp += bar.macdHist > 0 ? 15 : bar.macdHist < 0 ? -15 : 0;
      if (prev?.macdHist !== undefined) {
        macdComp += bar.macdHist > prev.macdHist ? 10 : bar.macdHist < prev.macdHist ? -10 : 0;
      }
      macdComp = Math.max(-50, Math.min(50, macdComp));
    }

    // ── RSI 컴포넌트 (-30 ~ +30) ──────────────────────────────────────────
    // 과매도(< rsiOversold) → 반등 기대 → +30 / 과매수(> rsiOverbought) → -30
    let rsiComp = 0;
    if (bar.rsi !== undefined) {
      if (bar.rsi <= config.rsiOversold) {
        rsiComp = 30;
      } else if (bar.rsi >= config.rsiOverbought) {
        rsiComp = -30;
      } else {
        // RSI 30~70 → 선형 매핑: RSI=50 → 0, RSI=30 → +20, RSI=70 → -20
        rsiComp = Math.max(-20, Math.min(20, Math.round((50 - bar.rsi) / 20 * 20)));
      }
    }

    // ── 거래량 컴포넌트 (-20 ~ +20) ───────────────────────────────────────
    // 고거래량(> volumeMA × threshold) 이 MACD 방향을 확인할 때만 반영
    let volComp = 0;
    if (bar.volumeMA !== undefined && bar.volumeMA > 0 && bar.volume > bar.volumeMA * volThreshold) {
      volComp = macdComp >= 0 ? 20 : -20;
    }

    const signalStrength = Math.max(-100, Math.min(100, macdComp + rsiComp + volComp));

    // ── 추세 상태 분류 (5단계) ────────────────────────────────────────────
    const trendState: MarketBar['trendState'] =
      signalStrength >  50 ? 'strong_up'   :
      signalStrength >  20 ? 'weak_up'     :
      signalStrength < -50 ? 'strong_down' :
      signalStrength < -20 ? 'weak_down'   : 'neutral';

    // ── 다이버전스 감지 (20봉 룩백) ──────────────────────────────────────
    const slice   = enriched.slice(0, i + 1);
    const lb      = Math.min(20, i + 1);
    const bullishDiv = i >= 3 ? detectBullishDivergence(slice, lb) : false;
    const bearishDiv = i >= 3 ? detectBearishDivergence(slice, lb) : false;

    return { ...bar, signalStrength, trendState, bullishDiv, bearishDiv };
  });
}

// ── Mock data generators ──────────────────────────────────────────────────────

export function generateMockHistory(count: number, config: BotConfig): MarketBar[] {
  const bars: MarketBar[] = [];
  const now         = Date.now();
  const barInterval = config.timeframe === '1h' ? 3600000 : 3600000 * 4;
  let price = 72400;
  let trend = 0;

  for (let i = count; i > 0; i--) {
    const barTime = now - i * barInterval;
    const dateObj = new Date(barTime);
    const wave    = Math.sin(i * 0.15) * (price * 0.015) + Math.cos(i * 0.07) * (price * 0.01);
    const noise   = (Math.random() - 0.5) * (price * 0.008);
    if (i % 20 === 0) trend = (Math.random() - 0.48) * (price * 0.02);
    const prevPrice = price;
    price = Math.max(100, price + trend + wave * 0.2 + noise);
    const change = price - prevPrice;
    const open   = prevPrice;
    const close  = price;
    const high   = Math.max(open, close) + Math.abs(change) * (0.1 + Math.random() * 0.4);
    const low    = Math.min(open, close) - Math.abs(change) * (0.1 + Math.random() * 0.4);
    bars.push({
      time: dateObj.toLocaleTimeString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      timestamp: barTime,
      open:  parseFloat(open.toFixed(1)),
      high:  parseFloat(high.toFixed(1)),
      low:   parseFloat(low.toFixed(1)),
      close: parseFloat(close.toFixed(1)),
      volume: Math.floor(100 + Math.random() * 900),
    });
  }
  return computeIndicators(bars, config);
}

export function downsampleTo4h(bars1h: MarketBar[]): MarketBar[] {
  const bars4h: MarketBar[] = [];
  for (let i = 0; i < bars1h.length; i += 4) {
    const chunk = bars1h.slice(i, i + 4);
    if (!chunk.length) continue;
    const first = chunk[0], last = chunk[chunk.length - 1];
    bars4h.push({
      time: first.time, timestamp: first.timestamp,
      open:   first.open,
      high:   Math.max(...chunk.map(b => b.high)),
      low:    Math.min(...chunk.map(b => b.low)),
      close:  last.close,
      volume: chunk.reduce((s, b) => s + b.volume, 0),
    });
  }
  return bars4h;
}

export async function fetchRealCandleData(config: BotConfig, count = 260): Promise<MarketBar[]> {
  const match = config.symbol.match(/\d{6}/);
  if (!match) throw new Error('6자리 숫자 종목코드가 필요합니다. (예: 005930)');
  const code       = match[0];
  const fetchCount = Math.min(Math.max(count, 20), 300);

  try {
    const res = await fetch(`/api/stock/${code}/candles?count=${fetchCount}`);
    if (res.ok) {
      const candles: { date: string; open: number; high: number; low: number; close: number; volume: number }[] = await res.json();
      if (Array.isArray(candles) && candles.length > 0) {
        return candles.map(c => ({
          time: `${c.date.slice(4, 6)}/${c.date.slice(6, 8)}`,
          timestamp: new Date(`${c.date.slice(0, 4)}-${c.date.slice(4, 6)}-${c.date.slice(6, 8)}T00:00:00+09:00`).getTime(),
          open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
        }));
      }
    }
  } catch { /* fall through */ }

  const naverUrl = `https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=day&count=${fetchCount}&requestType=0`;
  let xmlText = '';
  for (const fn of [
    () => fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(naverUrl)}`).then(r => r.json()).then((j: any) => String(j.contents || '')),
    () => fetch(`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(naverUrl)}`).then(r => r.text()),
  ]) {
    if (xmlText) break;
    try { xmlText = await fn(); } catch { /* continue */ }
  }
  if (!xmlText) throw new Error('네이버 파이낸스 데이터를 가져오지 못했습니다.');

  const bars: MarketBar[] = [];
  const regex = /<item\s+data="([^"]+)"\s*\/>/g;
  let m;
  while ((m = regex.exec(xmlText)) !== null) {
    const parts = m[1].split('|');
    if (parts.length < 6) continue;
    const rawDate = parts[0];
    const open = parseFloat(parts[1]), high = parseFloat(parts[2]);
    const low  = parseFloat(parts[3]), close = parseFloat(parts[4]);
    const volume = parseFloat(parts[5]);
    if (isNaN(open) || isNaN(close)) continue;
    const y = parseInt(rawDate.slice(0, 4));
    const mo = parseInt(rawDate.slice(4, 6)) - 1;
    const d  = parseInt(rawDate.slice(6, 8));
    bars.push({
      time: `${String(mo + 1).padStart(2, '0')}/${String(d).padStart(2, '0')}`,
      timestamp: new Date(y, mo, d).getTime(),
      open, high, low, close, volume: Math.round(volume),
    });
  }
  if (!bars.length) throw new Error(`종목 ${code}의 데이터를 파싱할 수 없습니다.`);
  return bars;
}

export function generateNextBar(lastBar: MarketBar, config: BotConfig): MarketBar {
  const nextTimestamp = lastBar.timestamp + (config.timeframe === '1h' ? 3600000 : 3600000 * 4);
  const dateObj = new Date(nextTimestamp);
  const drift   = lastBar.close * 0.0001;
  const noise   = (Math.random() - 0.49) * (lastBar.close * 0.012);
  const close   = lastBar.close + drift + noise;
  const open    = lastBar.close;
  const high    = Math.max(open, close) + Math.abs(close - open) * (0.1 + Math.random() * 0.5);
  const low     = Math.min(open, close) - Math.abs(close - open) * (0.1 + Math.random() * 0.5);
  return {
    time: dateObj.toLocaleTimeString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    timestamp:  nextTimestamp,
    open:       parseFloat(open.toFixed(1)),
    high:       parseFloat(high.toFixed(1)),
    low:        parseFloat(low.toFixed(1)),
    close:      parseFloat(close.toFixed(1)),
    volume:     Math.floor(100 + Math.random() * 1200),
  };
}
