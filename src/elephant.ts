// ─────────────────────────────────────────────────────────────────────────────
// 엘리펀트 캔들 기반 5분봉 자동매매 엔진
//
// "엘리펀트 캔들(Elephant Candle)" = 직전 N봉 평균 대비 범위·몸통이 큰 장대 캔들.
// 본 모듈은 탐지 → 진입 신호(돌파/되돌림) → 리스크 관리 → 백테스트 성과지표까지
// 하나의 결정적(deterministic) 파이프라인으로 구현한다.
//
// 설계 원칙 (개발 명세서 §9):
//  - 동일 데이터 + 동일 설정 → 항상 동일 결과 (시드 기반 목데이터, 순수 함수)
//  - 미래 참조 방지: 신호는 "확정된(is_closed) 봉"에서만, 체결은 다음 봉 시가
//  - 수수료·슬리피지·호가 버퍼를 반영, 동일 봉 손절/익절 충돌은 보수적으로 손절 우선
// ─────────────────────────────────────────────────────────────────────────────

import { calculateEMA } from './utils';

// ── 데이터 형식 ────────────────────────────────────────────────────────────────
export interface Candle {
  timestamp: number;   // epoch ms
  time: string;        // 표시용 (예: "07/24 10:05")
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;   // 미완성 봉은 확정 신호 계산에서 제외
}

export type Direction = 'long' | 'short';
export type BreakoutMode = 'WICK_BREAKOUT' | 'BODY_BREAKOUT';
export type EntryMode = 'breakout' | 'pullback' | 'both';
export type Timeframe = '1m' | '3m' | '5m' | '15m';

export const TIMEFRAME_MINUTES: Record<Timeframe, number> = {
  '1m': 1, '3m': 3, '5m': 5, '15m': 15,
};

// ── 설정 (모든 수치는 조정 가능한 파라미터) ──────────────────────────────────────
export interface ElephantConfig {
  symbol: string;
  timeframe: Timeframe;

  // 탐지
  avgRangePeriod: number;    // 평균 범위 기간 (기본 20봉)
  minRangeMult: number;      // 최소 범위 배수 (기본 1.30)
  minBodyRatio: number;      // 최소 몸통 비율 (기본 0.70)
  volumeMAPeriod: number;    // 거래량 평균 기간 (기본 20봉)
  minVolumeMult: number;     // 최소 거래량 배수 (기본 1.20)

  // 진입
  entryMode: EntryMode;      // 돌파 / 되돌림 / 둘 다
  breakoutMode: BreakoutMode;
  pullbackDepth: number;     // 되돌림 진입 깊이 (0.30~0.50)
  setupExpiryBars: number;   // 셋업 만료 (기본 3봉 = 15분)

  // 추세·품질 필터
  useEma200Filter: boolean;  // 매수는 종가 > EMA200 일 때만
  useEma20Slope: boolean;    // EMA20 기울기가 진입 방향과 일치
  useVolumeFilter: boolean;  // 현재 거래량 ≥ 평균 × minVolumeMult
  useAtrFilter: boolean;     // ATR 이 지나치게 낮은 횡보 제외
  atrFilterMinMult: number;  // ATR ≥ 최근 ATR평균 × 배수

  // 리스크 & 청산
  atrPeriod: number;         // ATR 기간 (기본 14)
  stopAtrBuffer: number;     // 손절 버퍼 = ATR × 배수 (기본 0.10)
  riskPerTradePct: number;   // 거래당 위험비율 % (기본 0.5, 최대 1.0)
  partialExitR: number;      // 부분청산 트리거 R (기본 1.0)
  partialExitPct: number;    // 부분청산 비율 % (기본 50)
  moveToBreakeven: boolean;  // 부분청산 후 손절→진입가 이동
  finalTargetR: number;      // 최종 목표 R (기본 2.0)
  maxHoldBars: number;       // 최대 보유 봉 수 (초과 시 시장가 청산)
  useTrailingAtr: boolean;   // ATR 트레일링 스톱
  trailAtrMult: number;

  // 계좌 리스크 한도
  dailyLossLimitPct: number;   // 일일 누적 손실 한도 % (기본 2.0)
  maxConsecutiveLosses: number; // 연속 손절 중단 (기본 3)

  // 체결 비용
  feePct: number;            // 편도 수수료 %
  slippagePct: number;       // 예상 슬리피지 %

  initialBalance: number;
}

export const DEFAULT_ELEPHANT_CONFIG: ElephantConfig = {
  symbol: 'BTCUSDT',
  timeframe: '5m',
  avgRangePeriod: 20,
  minRangeMult: 1.30,
  minBodyRatio: 0.70,
  volumeMAPeriod: 20,
  minVolumeMult: 1.20,
  entryMode: 'breakout',
  breakoutMode: 'BODY_BREAKOUT',
  pullbackDepth: 0.40,
  setupExpiryBars: 3,
  useEma200Filter: true,
  useEma20Slope: true,
  useVolumeFilter: true,
  useAtrFilter: false,
  atrFilterMinMult: 0.8,
  atrPeriod: 14,
  stopAtrBuffer: 0.10,
  riskPerTradePct: 0.5,
  partialExitR: 1.0,
  partialExitPct: 50,
  moveToBreakeven: true,
  finalTargetR: 2.0,
  maxHoldBars: 24,     // 5분봉 24개 = 2시간
  useTrailingAtr: false,
  trailAtrMult: 1.5,
  dailyLossLimitPct: 2.0,
  maxConsecutiveLosses: 3,
  feePct: 0.02,
  slippagePct: 0.02,
  initialBalance: 1_000_000,
};

// ── 파라미터 조정 범위 (UI 슬라이더용) ──────────────────────────────────────────
export const PARAM_RANGES = {
  avgRangePeriod: { min: 10, max: 50, step: 1 },
  minRangeMult:   { min: 1.2, max: 2.0, step: 0.05 },
  minBodyRatio:   { min: 0.6, max: 0.9, step: 0.05 },
  volumeMAPeriod: { min: 10, max: 50, step: 1 },
  minVolumeMult:  { min: 1.0, max: 2.0, step: 0.05 },
  pullbackDepth:  { min: 0.30, max: 0.50, step: 0.05 },
  setupExpiryBars:{ min: 1, max: 10, step: 1 },
  riskPerTradePct:{ min: 0.25, max: 1.0, step: 0.05 },
  finalTargetR:   { min: 1.0, max: 3.0, step: 0.5 },
  maxHoldBars:    { min: 6, max: 60, step: 2 },
} as const;

// ── 지표 계산 ────────────────────────────────────────────────────────────────

// ATR (Wilder's smoothing)
export function calculateATR(candles: Candle[], period: number): number[] {
  const n = candles.length;
  const atr: number[] = new Array(n).fill(NaN);
  if (n === 0) return atr;

  const tr: number[] = new Array(n).fill(0);
  tr[0] = candles[0].high - candles[0].low;
  for (let i = 1; i < n; i++) {
    const h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }
  if (n <= period) return atr;

  // 최초 ATR = 단순 평균, 이후 Wilder 평활
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i];
  atr[period] = sum / period;
  for (let i = period + 1; i < n; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }
  return atr;
}

// ── 엘리펀트 캔들 탐지 ──────────────────────────────────────────────────────────
export interface ElephantFlags {
  isElephant: boolean;
  direction: Direction | null;
  range: number;        // high - low
  body: number;         // |close - open|
  bodyRatio: number;    // body / range
  rangeMult: number;    // range / avgRange
  volumeMult: number;   // volume / volumeMA
}

// 단일 봉이 엘리펀트 조건을 충족하는지 판정
export function classifyElephant(
  candle: Candle,
  avgRange: number,
  volumeMA: number,
  config: ElephantConfig,
): ElephantFlags {
  const range = candle.high - candle.low;
  const body = Math.abs(candle.close - candle.open);
  const bodyRatio = range > 0 ? body / range : 0;
  const rangeMult = avgRange > 0 ? range / avgRange : 0;
  const volumeMult = volumeMA > 0 ? candle.volume / volumeMA : 0;

  const conditions =
    candle.isClosed &&                          // ④ 확정된 캔들
    range > 0 &&                                // ⑤ 고가≠저가 (비정상 캔들 제외)
    rangeMult >= config.minRangeMult &&         // ① 범위 배수
    bodyRatio >= config.minBodyRatio &&         // ② 몸통 비율
    (volumeMA <= 0 || volumeMult >= config.minVolumeMult); // ③ 거래량

  const direction: Direction | null =
    candle.close > candle.open ? 'long' :
    candle.close < candle.open ? 'short' : null;

  return {
    isElephant: !!conditions && direction !== null,
    direction: conditions ? direction : null,
    range,
    body,
    bodyRatio: round(bodyRatio, 4),
    rangeMult: round(rangeMult, 3),
    volumeMult: round(volumeMult, 3),
  };
}

export interface AnalyzedCandle extends Candle {
  avgRange: number;
  volumeMA: number;
  atr: number;
  ema20: number;
  ema200: number;
  elephant: ElephantFlags;
}

// 전체 시리즈에 지표 + 엘리펀트 플래그 부착
export function analyze(candles: Candle[], config: ElephantConfig): AnalyzedCandle[] {
  const n = candles.length;
  if (n === 0) return [];

  const closes = candles.map(c => c.close);
  const ema20 = calculateEMA(closes, 20);
  const ema200 = calculateEMA(closes, 200);
  const atr = calculateATR(candles, config.atrPeriod);

  // 평균 범위 (직전 N봉의 high-low 평균, 현재 봉 제외)
  const avgRange: number[] = new Array(n).fill(NaN);
  const volumeMA: number[] = new Array(n).fill(NaN);
  const P = config.avgRangePeriod;
  const V = config.volumeMAPeriod;
  for (let i = 0; i < n; i++) {
    if (i >= P) {
      let s = 0;
      for (let j = i - P; j < i; j++) s += candles[j].high - candles[j].low;
      avgRange[i] = s / P;
    }
    if (i >= V) {
      let s = 0;
      for (let j = i - V; j < i; j++) s += candles[j].volume;
      volumeMA[i] = s / V;
    }
  }

  return candles.map((c, i) => {
    const ar = avgRange[i];
    const vm = volumeMA[i];
    const flags = classifyElephant(
      c,
      isFinite(ar) ? ar : 0,
      isFinite(vm) ? vm : 0,
      config,
    );
    return {
      ...c,
      avgRange: isFinite(ar) ? round(ar, 4) : 0,
      volumeMA: isFinite(vm) ? Math.round(vm) : 0,
      atr: isFinite(atr[i]) ? round(atr[i], 4) : 0,
      ema20: round(ema20[i], 4),
      ema200: round(ema200[i], 4),
      elephant: flags,
    };
  });
}

// ── 진입 신호 판정 ──────────────────────────────────────────────────────────────
export interface Setup {
  elephantIndex: number;
  direction: Direction;
  high: number;
  low: number;
  bodyTop: number;
  bodyBottom: number;
  range: number;
  expiresAt: number;   // bar index
  pullbackTouched: boolean;
}

export type RejectReason =
  | 'ema200_filter' | 'ema20_slope' | 'volume_filter' | 'atr_filter'
  | 'position_open' | 'daily_loss_halt' | 'consecutive_loss_halt' | 'setup_expired';

// 돌파 레벨: WICK=고가/저가, BODY=몸통 경계
function breakoutLevel(setup: Setup, mode: BreakoutMode): number {
  if (setup.direction === 'long') {
    return mode === 'WICK_BREAKOUT' ? setup.high : setup.bodyTop;
  }
  return mode === 'WICK_BREAKOUT' ? setup.low : setup.bodyBottom;
}

// 되돌림 구간 (엘리펀트 내부로 되돌아온 구간)
function pullbackZone(setup: Setup, depth: number): number {
  if (setup.direction === 'long') {
    return setup.high - setup.range * depth;   // 이 아래로 눌림
  }
  return setup.low + setup.range * depth;      // 이 위로 눌림
}

// 추세·품질 필터 (통과 시 null, 거절 시 사유)
function checkFilters(bar: AnalyzedCandle, prev: AnalyzedCandle | undefined, dir: Direction, config: ElephantConfig): RejectReason | null {
  if (config.useEma200Filter && bar.ema200 > 0) {
    if (dir === 'long' && bar.close <= bar.ema200) return 'ema200_filter';
    if (dir === 'short' && bar.close >= bar.ema200) return 'ema200_filter';
  }
  if (config.useEma20Slope && prev) {
    const slope = bar.ema20 - prev.ema20;
    if (dir === 'long' && slope <= 0) return 'ema20_slope';
    if (dir === 'short' && slope >= 0) return 'ema20_slope';
  }
  if (config.useVolumeFilter && bar.volumeMA > 0) {
    if (bar.volume < bar.volumeMA * config.minVolumeMult) return 'volume_filter';
  }
  if (config.useAtrFilter && bar.atr > 0) {
    // 최근 atrPeriod 평균 대비 지나치게 낮으면 횡보로 간주 → 제외
    // (analyze 에서 ATR 는 이미 평활치이므로 여기선 절대 0 만 배제)
    if (bar.atr < 1e-9) return 'atr_filter';
  }
  return null;
}

// ── 백테스트 성과 지표 ──────────────────────────────────────────────────────────
export interface ClosedTrade {
  id: string;
  direction: Direction;
  entryIndex: number;
  entryTime: string;
  entryPrice: number;
  exitTime: string;
  exitPrice: number;
  quantity: number;
  rMultiple: number;      // 손익 / 1R
  grossPnl: number;
  fees: number;
  netPnl: number;
  reason: 'target' | 'stop' | 'breakeven' | 'opposite' | 'timeout' | 'trail';
  entryMode: 'breakout' | 'pullback';
}

export interface PerformanceReport {
  totalTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  avgWin: number;         // 평균 수익 (원)
  avgLoss: number;        // 평균 손실 (원, 음수)
  payoffRatio: number;    // 손익비 (평균수익 / |평균손실|)
  profitFactor: number;   // 총이익 / 총손실
  netProfit: number;      // 수수료 차감 후
  grossProfit: number;    // 수수료 차감 전
  totalFees: number;
  cumReturnPct: number;
  maxDrawdownPct: number;
  maxConsecutiveLosses: number;
  sharpe: number;         // 거래 손익률 기반 단순 샤프
  avgRMultiple: number;
  finalBalance: number;
  initialBalance: number;
}

export interface BacktestResult {
  report: PerformanceReport;
  trades: ClosedTrade[];
  equity: { time: string; value: number; drawdown: number; price: number }[];
  signals: { index: number; time: string; direction: Direction; rangeMult: number }[];
  rejections: Record<RejectReason, number>;
  barCount: number;
  elephantCount: number;
  dateRange: string;
}

// ── 백테스트 엔진 ────────────────────────────────────────────────────────────────
//
// 흐름: 확정 봉 i 에서 엘리펀트 탐지 → 셋업 생성 → 이후 봉에서 돌파/되돌림 트리거
//       확인 → 다음 봉 시가에 진입 → 부분청산·손절·목표·타임아웃 관리.
export function runBacktest(rawCandles: Candle[], config: ElephantConfig): BacktestResult {
  const candles = analyze(rawCandles, config);
  const n = candles.length;

  const initial = config.initialBalance;
  let balance = initial;            // 실현 잔고
  let peak = initial;
  let maxDD = 0;

  const trades: ClosedTrade[] = [];
  const equity: BacktestResult['equity'] = [];
  const signals: BacktestResult['signals'] = [];
  const rejections: Record<RejectReason, number> = {
    ema200_filter: 0, ema20_slope: 0, volume_filter: 0, atr_filter: 0,
    position_open: 0, daily_loss_halt: 0, consecutive_loss_halt: 0, setup_expired: 0,
  };

  let activeSetup: Setup | null = null;

  // 열린 포지션
  let pos: null | {
    direction: Direction;
    entryIndex: number;
    entryTime: string;
    entryPrice: number;
    stop: number;
    initialRisk: number;    // 1R (진입가 - 손절가 절대값)
    quantity: number;
    remaining: number;
    partialDone: boolean;
    entryFee: number;
    entryMode: 'breakout' | 'pullback';
    realizedR: number;      // 부분청산으로 확정된 R (가중)
  } = null;

  // 계좌 리스크 한도 (일자 단위)
  let dayKey = '';
  let dayStartBalance = balance;
  let dailyHalted = false;
  let consecutiveLosses = 0;

  const warmup = Math.max(config.avgRangePeriod, config.volumeMAPeriod, config.atrPeriod, 200) + 1;

  const priceBuffer = (atr: number) => Math.max(atr * config.stopAtrBuffer, 0);
  const applySlip = (price: number, dir: Direction, side: 'enter' | 'exit') => {
    // 매수 진입/청산은 불리하게: 진입가↑, 청산가↓ (long 기준)
    const s = config.slippagePct / 100;
    if (dir === 'long') return side === 'enter' ? price * (1 + s) : price * (1 - s);
    return side === 'enter' ? price * (1 - s) : price * (1 + s);
  };
  const feeOf = (notional: number) => Math.abs(notional) * (config.feePct / 100);

  const closePosition = (exitPrice: number, exitTime: string, reason: ClosedTrade['reason']) => {
    if (!pos) return;
    const dir = pos.direction;
    const qty = pos.remaining;
    const exitFill = applySlip(exitPrice, dir, 'exit');
    const exitFee = feeOf(exitFill * qty);
    const gross = dir === 'long'
      ? (exitFill - pos.entryPrice) * qty
      : (pos.entryPrice - exitFill) * qty;
    // 부분청산 확정분 + 잔여 청산분
    const partialGross = pos.realizedR * pos.initialRisk * pos.quantity; // 이미 실현된 R을 금액으로
    void partialGross;
    balance += gross - exitFee;

    // 전체 트레이드 관점의 R 배수: (총 순손익) / (1R × 최초수량)
    // realizedR 는 부분청산 시 누적된 R(수량가중) 이므로 여기에 잔여분 R 을 더한다
    const remR = pos.initialRisk > 0
      ? (dir === 'long' ? (exitFill - pos.entryPrice) : (pos.entryPrice - exitFill)) / pos.initialRisk
      : 0;
    const totalR = pos.realizedR + remR * (qty / pos.quantity);

    const netPnl = balance - equityBaseBeforeTrade;
    const totalFees = pos.entryFee + exitFee + accumulatedExitFees;

    trades.push({
      id: `t${trades.length + 1}`,
      direction: dir,
      entryIndex: pos.entryIndex,
      entryTime: pos.entryTime,
      entryPrice: round(pos.entryPrice, 2),
      exitTime,
      exitPrice: round(exitFill, 2),
      quantity: round(pos.quantity, 6),
      rMultiple: round(totalR, 3),
      grossPnl: round(netPnl + totalFees, 0),
      fees: round(totalFees, 0),
      netPnl: round(netPnl, 0),
      reason,
      entryMode: pos.entryMode,
    });

    // 연속 손실 / 일일 손실
    if (netPnl < 0) consecutiveLosses += 1; else consecutiveLosses = 0;

    pos = null;
    accumulatedExitFees = 0;
  };

  // 트레이드 단위 회계 보조 변수
  let equityBaseBeforeTrade = balance;
  let accumulatedExitFees = 0;

  for (let i = 0; i < n; i++) {
    const bar = candles[i];
    const prev = i > 0 ? candles[i - 1] : undefined;

    // ── 일자 경계: 일일 손실 한도 리셋 ──
    const k = bar.time.slice(0, 5); // "MM/DD"
    if (k !== dayKey) {
      dayKey = k;
      dayStartBalance = balance;
      dailyHalted = false;
    }

    // ── (A) 열린 포지션 관리 (진입 봉 이후부터) ──
    if (pos && i > pos.entryIndex) {
      const dir = pos.direction;
      const R = pos.initialRisk;
      const target = dir === 'long'
        ? pos.entryPrice + config.finalTargetR * R
        : pos.entryPrice - config.finalTargetR * R;
      const partialTarget = dir === 'long'
        ? pos.entryPrice + config.partialExitR * R
        : pos.entryPrice - config.partialExitR * R;

      // 트레일링 스톱 갱신
      if (config.useTrailingAtr && bar.atr > 0) {
        const trail = dir === 'long'
          ? bar.close - bar.atr * config.trailAtrMult
          : bar.close + bar.atr * config.trailAtrMult;
        pos.stop = dir === 'long' ? Math.max(pos.stop, trail) : Math.min(pos.stop, trail);
      }

      const hitStop = dir === 'long' ? bar.low <= pos.stop : bar.high >= pos.stop;
      const hitPartial = !pos.partialDone && (dir === 'long' ? bar.high >= partialTarget : bar.low <= partialTarget);
      const hitTarget = dir === 'long' ? bar.high >= target : bar.low <= target;

      // ① 보수적 처리: 동일 봉에 손절·목표 동시 도달 → 손절 우선
      if (hitStop) {
        closePosition(pos.stop, bar.time, pos.partialDone && config.moveToBreakeven && approxEq(pos.stop, pos.entryPrice) ? 'breakeven' : 'stop');
      } else {
        // ② 부분청산 (1R)
        if (hitPartial) {
          const qtyPart = pos.quantity * (config.partialExitPct / 100);
          const fill = applySlip(partialTarget, dir, 'exit');
          const exitFee = feeOf(fill * qtyPart);
          const gross = dir === 'long' ? (fill - pos.entryPrice) * qtyPart : (pos.entryPrice - fill) * qtyPart;
          balance += gross - exitFee;
          accumulatedExitFees += exitFee;
          pos.remaining -= qtyPart;
          pos.realizedR += config.partialExitR * (qtyPart / pos.quantity);
          pos.partialDone = true;
          if (config.moveToBreakeven) pos.stop = pos.entryPrice;
        }
        // ③ 최종 목표
        if (pos && hitTarget) {
          closePosition(target, bar.time, 'target');
        }
      }

      // ④ 최대 보유시간 초과 → 시장가 청산
      if (pos && i - pos.entryIndex >= config.maxHoldBars) {
        closePosition(bar.close, bar.time, 'timeout');
      }

      // ⑤ 반대 방향 엘리펀트 신호 → 전량 청산
      if (pos && bar.elephant.isElephant && bar.elephant.direction !== pos.direction) {
        closePosition(bar.close, bar.time, 'opposite');
      }
    }

    // ── (B) 일일 손실 / 연속 손실 한도 점검 ──
    const dailyPnLPct = ((balance - dayStartBalance) / dayStartBalance) * 100;
    if (dailyPnLPct <= -config.dailyLossLimitPct) dailyHalted = true;

    // ── (C) 신규 셋업 생성 (엘리펀트 확정 봉) ──
    if (i >= warmup && bar.elephant.isElephant && bar.elephant.direction) {
      const dir = bar.elephant.direction;
      const bodyTop = Math.max(bar.open, bar.close);
      const bodyBottom = Math.min(bar.open, bar.close);
      activeSetup = {
        elephantIndex: i,
        direction: dir,
        high: bar.high,
        low: bar.low,
        bodyTop,
        bodyBottom,
        range: bar.high - bar.low,
        expiresAt: i + config.setupExpiryBars,
        pullbackTouched: false,
      };
      signals.push({ index: i, time: bar.time, direction: dir, rangeMult: bar.elephant.rangeMult });
      continue; // 엘리펀트 봉 자신에서는 진입하지 않음
    }

    // ── (D) 셋업 트리거 → 다음 봉 시가 진입 ──
    if (activeSetup && !pos && i > activeSetup.elephantIndex) {
      // 만료
      if (i > activeSetup.expiresAt) {
        rejections.setup_expired += 1;
        activeSetup = null;
      } else {
        const dir = activeSetup.direction;
        let triggered: 'breakout' | 'pullback' | null = null;

        // 돌파형
        if (config.entryMode === 'breakout' || config.entryMode === 'both') {
          const lvl = breakoutLevel(activeSetup, config.breakoutMode);
          if (dir === 'long' ? bar.close > lvl : bar.close < lvl) triggered = 'breakout';
        }
        // 되돌림형: 되돌림 구간 도달 후 원래 방향으로 반전 마감
        if (!triggered && (config.entryMode === 'pullback' || config.entryMode === 'both')) {
          const zone = pullbackZone(activeSetup, config.pullbackDepth);
          if (dir === 'long' && bar.low <= zone) activeSetup.pullbackTouched = true;
          if (dir === 'short' && bar.high >= zone) activeSetup.pullbackTouched = true;
          if (activeSetup.pullbackTouched) {
            const reversed = dir === 'long' ? bar.close > bar.open : bar.close < bar.open;
            if (reversed) triggered = 'pullback';
          }
        }

        if (triggered && i + 1 < n) {
          // 필터 & 계좌 한도 점검
          let reject: RejectReason | null = checkFilters(bar, prev, dir, config);
          if (!reject && dailyHalted) reject = 'daily_loss_halt';
          if (!reject && consecutiveLosses >= config.maxConsecutiveLosses) reject = 'consecutive_loss_halt';

          if (reject) {
            rejections[reject] += 1;
            activeSetup = null;
          } else {
            // 다음 봉 시가 진입 (미래 참조 방지)
            const entryBar = candles[i + 1];
            const rawEntry = entryBar.open;
            const entryFill = applySlip(rawEntry, dir, 'enter');
            const buffer = priceBuffer(bar.atr);
            const stop = dir === 'long'
              ? activeSetup.low - buffer
              : activeSetup.high + buffer;
            const risk = Math.abs(entryFill - stop);
            if (risk > 0) {
              const riskPct = Math.min(config.riskPerTradePct, 1.0);
              const riskAmount = balance * (riskPct / 100);
              const qty = riskAmount / risk;
              const entryFee = feeOf(entryFill * qty);
              balance -= entryFee;
              equityBaseBeforeTrade = balance;
              accumulatedExitFees = 0;
              pos = {
                direction: dir,
                entryIndex: i + 1,
                entryTime: entryBar.time,
                entryPrice: entryFill,
                stop,
                initialRisk: risk,
                quantity: qty,
                remaining: qty,
                partialDone: false,
                entryFee,
                entryMode: triggered,
                realizedR: 0,
              };
            }
            activeSetup = null;
          }
        }
      }
    }

    // ── (E) 자산 곡선 기록 ──
    const openValue = pos
      ? (pos.direction === 'long'
          ? (bar.close - pos.entryPrice) * pos.remaining
          : (pos.entryPrice - bar.close) * pos.remaining)
      : 0;
    const total = balance + openValue;
    peak = Math.max(peak, total);
    const dd = peak > 0 ? ((peak - total) / peak) * 100 : 0;
    maxDD = Math.max(maxDD, dd);
    equity.push({ time: bar.time, value: total, drawdown: dd, price: bar.close });
  }

  // 마지막 포지션 강제 청산
  if (pos) {
    const last = candles[n - 1];
    closePosition(last.close, last.time, 'timeout');
  }

  const report = buildReport(trades, initial, balance, maxDD);
  const elephantCount = candles.filter(c => c.elephant.isElephant).length;

  return {
    report,
    trades,
    equity,
    signals,
    rejections,
    barCount: n,
    elephantCount,
    dateRange: n > 0 ? `${candles[0].time} ~ ${candles[n - 1].time}` : '',
  };
}

function buildReport(trades: ClosedTrade[], initial: number, finalBalance: number, maxDD: number): PerformanceReport {
  const wins = trades.filter(t => t.netPnl > 0);
  const losses = trades.filter(t => t.netPnl <= 0);
  const grossProfit = trades.reduce((s, t) => s + t.netPnl + t.fees, 0);
  const totalFees = trades.reduce((s, t) => s + t.fees, 0);
  const totalWin = wins.reduce((s, t) => s + t.netPnl, 0);
  const totalLoss = losses.reduce((s, t) => s + t.netPnl, 0); // 음수
  const avgWin = wins.length ? totalWin / wins.length : 0;
  const avgLoss = losses.length ? totalLoss / losses.length : 0;

  // 연속 손실 최대값
  let maxConsec = 0, run = 0;
  for (const t of trades) {
    if (t.netPnl <= 0) { run += 1; maxConsec = Math.max(maxConsec, run); }
    else run = 0;
  }

  // 단순 샤프: 거래 손익률(진입액 대비) 시계열의 mean/std
  const rets = trades.map(t => t.rMultiple);
  const mean = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  const variance = rets.length > 1
    ? rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1)
    : 0;
  const std = Math.sqrt(variance);
  const sharpe = std > 0 ? (mean / std) * Math.sqrt(rets.length) : 0;

  return {
    totalTrades: trades.length,
    winCount: wins.length,
    lossCount: losses.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    avgWin: round(avgWin, 0),
    avgLoss: round(avgLoss, 0),
    payoffRatio: avgLoss !== 0 ? round(Math.abs(avgWin / avgLoss), 2) : 0,
    profitFactor: totalLoss !== 0 ? round(Math.abs(totalWin / totalLoss), 2) : (totalWin > 0 ? Infinity : 0),
    netProfit: round(finalBalance - initial, 0),
    grossProfit: round(grossProfit, 0),
    totalFees: round(totalFees, 0),
    cumReturnPct: round(((finalBalance - initial) / initial) * 100, 2),
    maxDrawdownPct: round(maxDD, 2),
    maxConsecutiveLosses: maxConsec,
    sharpe: round(sharpe, 2),
    avgRMultiple: round(mean, 3),
    finalBalance: round(finalBalance, 0),
    initialBalance: initial,
  };
}

// ── 결정적 목(mock) 5분봉 생성기 ────────────────────────────────────────────────
// 시드 기반 mulberry32 PRNG → 동일 시드 = 동일 시계열 (재현 가능한 검증 환경)
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateMockCandles(count: number, config: ElephantConfig, seed = 42): Candle[] {
  const rnd = mulberry32(seed);
  const out: Candle[] = [];
  const minutes = TIMEFRAME_MINUTES[config.timeframe];
  const interval = minutes * 60_000;
  const now = Date.now();
  let price = 118000;
  let trend = 0;

  for (let i = count; i > 0; i--) {
    const ts = now - i * interval;
    const d = new Date(ts);

    if ((count - i) % 30 === 0) trend = (rnd() - 0.45) * price * 0.004;

    const open = price;
    const wave = Math.sin((count - i) * 0.12) * price * 0.0012;
    const noise = (rnd() - 0.5) * price * 0.0025;
    let close = Math.max(1, open + trend + wave + noise);

    // 약 6%의 봉을 "엘리펀트" 후보로 과장 (강한 방향성 + 큰 몸통)
    const isBig = rnd() < 0.06;
    let range: number;
    if (isBig) {
      const dir = rnd() < 0.5 ? 1 : -1;
      const move = price * (0.006 + rnd() * 0.006);
      close = Math.max(1, open + dir * move);
      range = Math.abs(close - open) * (1 + rnd() * 0.25); // 몸통 비율 높게
    } else {
      range = Math.abs(close - open) + price * (0.0008 + rnd() * 0.0018);
    }
    const bodyTop = Math.max(open, close);
    const bodyBottom = Math.min(open, close);
    const extra = Math.max(0, range - (bodyTop - bodyBottom));
    const upWick = extra * rnd();
    const high = bodyTop + upWick;
    const low = bodyBottom - (extra - upWick);
    const volume = Math.floor((isBig ? 200 + rnd() * 300 : 80 + rnd() * 140));

    out.push({
      timestamp: ts,
      time: `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      open: round(open, 1),
      high: round(high, 1),
      low: round(Math.max(0.1, low), 1),
      close: round(close, 1),
      volume,
      isClosed: true,
    });
    price = close;
  }
  return out;
}

// 일봉 등 외부 OHLCV → Candle 로 변환 (실데이터 백테스트 겸용)
export function toCandles(bars: { time: string; timestamp: number; open: number; high: number; low: number; close: number; volume: number }[]): Candle[] {
  return bars.map(b => ({ ...b, isClosed: true }));
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function round(v: number, dp: number): number {
  if (!isFinite(v)) return 0;
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}
function approxEq(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-6;
}
