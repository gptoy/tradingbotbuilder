import { BotConfig, MarketBar } from './types';

// Simple EMA calculation
export function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  if (data.length === 0) return ema;

  const k = 2 / (period + 1);
  let prevEma = data[0];
  ema.push(prevEma);

  for (let i = 1; i < data.length; i++) {
    const currentEma = data[i] * k + prevEma * (1 - k);
    ema.push(currentEma);
    prevEma = currentEma;
  }
  return ema;
}

// Full indicator calculation (RSI and MACD)
export function computeIndicators(bars: MarketBar[], config: BotConfig): MarketBar[] {
  if (bars.length === 0) return [];

  const closes = bars.map(b => b.close);
  const n = bars.length;

  // 1. Calculate RSI
  const rsi: number[] = new Array(n).fill(50);
  if (n > config.rsiPeriod) {
    const deltas: number[] = [];
    for (let i = 1; i < n; i++) {
      deltas.push(closes[i] - closes[i - 1]);
    }

    let avgGain = 0;
    let avgLoss = 0;

    // First RSI period SMA
    for (let i = 0; i < config.rsiPeriod; i++) {
      const d = deltas[i];
      if (d > 0) avgGain += d;
      else avgLoss -= d;
    }
    avgGain /= config.rsiPeriod;
    avgLoss /= config.rsiPeriod;

    rsi[config.rsiPeriod] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    // Wilder's smoothing
    for (let i = config.rsiPeriod + 1; i < n; i++) {
      const d = deltas[i - 1];
      const gain = d > 0 ? d : 0;
      const loss = d < 0 ? -d : 0;

      avgGain = (avgGain * (config.rsiPeriod - 1) + gain) / config.rsiPeriod;
      avgLoss = (avgLoss * (config.rsiPeriod - 1) + loss) / config.rsiPeriod;

      rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
  }

  // 2. Calculate MACD
  const emaFast = calculateEMA(closes, config.macdFast);
  const emaSlow = calculateEMA(closes, config.macdSlow);
  
  const macdLine: number[] = [];
  for (let i = 0; i < n; i++) {
    macdLine.push(emaFast[i] - emaSlow[i]);
  }

  const macdSignal = calculateEMA(macdLine, config.macdSignal);
  
  const macdHist: number[] = [];
  for (let i = 0; i < n; i++) {
    macdHist.push(macdLine[i] - macdSignal[i]);
  }

  // 3. Calculate configurable Simple Moving Average (MA) for 5-condition scoring
  const ma: (number | null)[] = new Array(n).fill(null);
  for (let i = config.maPeriod - 1; i < n; i++) {
    const slice = closes.slice(i - config.maPeriod + 1, i + 1);
    ma[i] = slice.reduce((a, b) => a + b, 0) / config.maPeriod;
  }

  // 4. Calculate Volume Moving Average
  const volumes = bars.map(b => b.volume);
  const volMA: (number | null)[] = new Array(n).fill(null);
  for (let i = config.volumeMAPeriod - 1; i < n; i++) {
    const slice = volumes.slice(i - config.volumeMAPeriod + 1, i + 1);
    volMA[i] = slice.reduce((a, b) => a + b, 0) / config.volumeMAPeriod;
  }

  // 5. Calculate fixed SMA: 20, 60, 120 (partial avg for early bars so always defined)
  const calcSMA = (data: number[], period: number): number[] => {
    return data.map((_, i) => {
      const start = Math.max(0, i - period + 1);
      const slice = data.slice(start, i + 1);
      return parseFloat((slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(1));
    });
  };
  const ma20arr = calcSMA(closes, 20);
  const ma60arr = calcSMA(closes, 60);
  const ma120arr = calcSMA(closes, 120);

  // Map indicators back to bars
  return bars.map((bar, idx) => ({
    ...bar,
    rsi: parseFloat(rsi[idx].toFixed(2)),
    macd: parseFloat(macdLine[idx].toFixed(4)),
    macdSignal: parseFloat(macdSignal[idx].toFixed(4)),
    macdHist: parseFloat(macdHist[idx].toFixed(4)),
    ma: ma[idx] !== null ? parseFloat((ma[idx] as number).toFixed(2)) : undefined,
    volumeMA: volMA[idx] !== null ? Math.round(volMA[idx] as number) : undefined,
    ma20: ma20arr[idx],
    ma60: ma60arr[idx],
    ma120: ma120arr[idx],
  }));
}

// Generate realistic mock market history
export function generateMockHistory(count: number, config: BotConfig): MarketBar[] {
  const bars: MarketBar[] = [];
  const now = Date.now();
  const barInterval = config.timeframe === '1h' ? 3600000 : 3600000 * 4;

  let price = 72400; // Starting price (KRW, stock)
  let trend = 0;

  for (let i = count; i > 0; i--) {
    const barTime = now - i * barInterval;
    const dateObj = new Date(barTime);
    
    // Create organic-looking waves
    const wave = Math.sin(i * 0.15) * (price * 0.015) + Math.cos(i * 0.07) * (price * 0.01);
    // Add minor random noise
    const noise = (Math.random() - 0.5) * (price * 0.008);
    
    // Slow structural shifts
    if (i % 20 === 0) {
      trend = (Math.random() - 0.48) * (price * 0.02); // slight bullish bias
    }

    const prevPrice = price;
    price = price + trend + wave * 0.2 + noise;
    
    // Ensure positive price
    if (price <= 100) price = 100;

    const change = price - prevPrice;
    const open = prevPrice;
    const close = price;
    const high = Math.max(open, close) + Math.abs(change) * (0.1 + Math.random() * 0.4);
    const low = Math.min(open, close) - Math.abs(change) * (0.1 + Math.random() * 0.4);
    const volume = Math.floor(100 + Math.random() * 900);

    const timeString = dateObj.toLocaleTimeString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    bars.push({
      time: timeString,
      timestamp: barTime,
      open: parseFloat(open.toFixed(1)),
      high: parseFloat(high.toFixed(1)),
      low: parseFloat(low.toFixed(1)),
      close: parseFloat(close.toFixed(1)),
      volume,
    });
  }

  return computeIndicators(bars, config);
}

// Downsample 1h candles to 4h candles
export function downsampleTo4h(bars1h: MarketBar[]): MarketBar[] {
  const bars4h: MarketBar[] = [];
  for (let i = 0; i < bars1h.length; i += 4) {
    const chunk = bars1h.slice(i, i + 4);
    if (chunk.length === 0) continue;
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    bars4h.push({
      time: first.time,
      timestamp: first.timestamp,
      open: first.open,
      high: Math.max(...chunk.map(b => b.high)),
      low: Math.min(...chunk.map(b => b.low)),
      close: last.close,
      volume: chunk.reduce((s, b) => s + b.volume, 0),
    });
  }
  return bars4h;
}

// Fetch real historical candles — tries Vite plugin proxy first, then public fallbacks
export async function fetchRealCandleData(config: BotConfig, count = 260): Promise<MarketBar[]> {
  const match = config.symbol.match(/\d{6}/);
  if (!match) throw new Error('6자리 숫자 종목코드가 필요합니다. (예: 005930)');
  const code = match[0];
  const fetchCount = Math.min(Math.max(count, 20), 300); // 20~300 사이로 제한

  // 1. Vite plugin server-side proxy (most reliable, no CORS)
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
  } catch { /* fall through to public proxies */ }

  // 2 & 3. Public CORS proxy fallbacks (parse Naver fchart XML)
  const naverUrl = `https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=day&count=${fetchCount}&requestType=0`;
  let xmlText = '';
  for (const fetchFn of [
    () => fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(naverUrl)}`).then(r => r.json()).then((j: any) => String(j.contents || '')),
    () => fetch(`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(naverUrl)}`).then(r => r.text()),
  ]) {
    if (xmlText) break;
    try { xmlText = await fetchFn(); } catch { /* continue */ }
  }

  if (!xmlText) throw new Error('네이버 파이낸스 데이터를 가져오지 못했습니다. 네트워크를 확인하세요.');

  const bars: MarketBar[] = [];
  const regex = /<item\s+data="([^"]+)"\s*\/>/g;
  let m;
  while ((m = regex.exec(xmlText)) !== null) {
    const parts = m[1].split('|');
    if (parts.length < 6) continue;
    const rawDate = parts[0];
    const open = parseFloat(parts[1]), high = parseFloat(parts[2]);
    const low = parseFloat(parts[3]), close = parseFloat(parts[4]);
    const volume = parseFloat(parts[5]);
    if (isNaN(open) || isNaN(close)) continue;
    const y = parseInt(rawDate.slice(0, 4));
    const mo = parseInt(rawDate.slice(4, 6)) - 1;
    const d = parseInt(rawDate.slice(6, 8));
    bars.push({
      time: `${String(mo + 1).padStart(2, '0')}/${String(d).padStart(2, '0')}`,
      timestamp: new Date(y, mo, d).getTime(),
      open, high, low, close, volume: Math.round(volume),
    });
  }
  if (bars.length === 0) throw new Error(`종목 ${code}의 데이터를 파싱할 수 없습니다.`);
  return bars;
}

// Create a single next bar
export function generateNextBar(lastBar: MarketBar, config: BotConfig): MarketBar {
  const nextTimestamp = lastBar.timestamp + (config.timeframe === '1h' ? 3600000 : 3600000 * 4);
  const dateObj = new Date(nextTimestamp);
  
  // Random walk with a tiny drift
  const drift = lastBar.close * 0.0001; 
  const noise = (Math.random() - 0.49) * (lastBar.close * 0.012); // Slightly bullish drift
  const close = lastBar.close + drift + noise;
  const open = lastBar.close;
  
  const high = Math.max(open, close) + Math.abs(close - open) * (0.1 + Math.random() * 0.5);
  const low = Math.min(open, close) - Math.abs(close - open) * (0.1 + Math.random() * 0.5);
  const volume = Math.floor(100 + Math.random() * 1200);

  const timeString = dateObj.toLocaleTimeString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    time: timeString,
    timestamp: nextTimestamp,
    open: parseFloat(open.toFixed(1)),
    high: parseFloat(high.toFixed(1)),
    low: parseFloat(low.toFixed(1)),
    close: parseFloat(close.toFixed(1)),
    volume,
  };
}
