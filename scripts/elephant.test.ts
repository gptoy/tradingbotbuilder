// ─────────────────────────────────────────────────────────────────────────────
// 엘리펀트 캔들 엔진 자동 검증 (개발 명세서 §9)
//   실행: npm run test:elephant
//   검증 항목: 캔들 탐지 · 포지션 크기 · 손절 · 부분청산 · 수수료 계산 · 결정성
// ─────────────────────────────────────────────────────────────────────────────
import {
  Candle, ElephantConfig, DEFAULT_ELEPHANT_CONFIG,
  classifyElephant, calculateATR, runBacktest, generateMockCandles,
} from '../src/elephant';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.error(`  ❌ ${msg}`); }
}
function approx(a: number, b: number, tol = 1e-6) { return Math.abs(a - b) <= tol; }

const cfg: ElephantConfig = { ...DEFAULT_ELEPHANT_CONFIG };

function mkCandle(o: number, h: number, l: number, c: number, v: number, isClosed = true): Candle {
  return { timestamp: 0, time: '07/24 10:00', open: o, high: h, low: l, close: c, volume: v, isClosed };
}

// ── 1. 엘리펀트 탐지 규칙 ──────────────────────────────────────────────────────
console.log('\n[1] 엘리펀트 캔들 탐지');
{
  // range=100, avgRange=50 → 2× (≥1.30 통과), body=90/100=0.9 (≥0.70), vol 2× (≥1.20)
  const big = mkCandle(100, 200, 100, 190, 240);
  const f1 = classifyElephant(big, 50, 100, cfg);
  assert(f1.isElephant && f1.direction === 'long', '큰 범위·큰 몸통·고거래량 → 엘리펀트(양봉)');

  // 몸통 비율 부족: body=10/100=0.1 < 0.70
  const doji = mkCandle(150, 200, 100, 140, 240);
  assert(!classifyElephant(doji, 50, 100, cfg).isElephant, '몸통 비율 미달 → 탐지 제외');

  // 범위 배수 부족: range=40, avg=50 → 0.8× < 1.30
  const small = mkCandle(100, 140, 100, 138, 240);
  assert(!classifyElephant(small, 50, 100, cfg).isElephant, '범위 배수 미달 → 탐지 제외');

  // 거래량 부족: vol=100, ma=100 → 1.0× < 1.20
  assert(!classifyElephant(mkCandle(100, 200, 100, 190, 100), 50, 100, cfg).isElephant, '거래량 배수 미달 → 탐지 제외');

  // 미완성 봉 제외
  assert(!classifyElephant(mkCandle(100, 200, 100, 190, 240, false), 50, 100, cfg).isElephant, '미완성 봉 → 탐지 제외');

  // 고가=저가 비정상 봉
  assert(!classifyElephant(mkCandle(100, 100, 100, 100, 240), 50, 100, cfg).isElephant, '고가=저가 → 탐지 제외');

  // 음봉 방향
  const bear = mkCandle(200, 200, 100, 110, 240);
  const fb = classifyElephant(bear, 50, 100, cfg);
  assert(fb.isElephant && fb.direction === 'short', '큰 음봉 → 엘리펀트(음봉/short)');
}

// ── 2. ATR 계산 (Wilder) ──────────────────────────────────────────────────────
console.log('\n[2] ATR 계산');
{
  // TR 이 일정하게 10 인 시리즈 → ATR 은 10 으로 수렴
  const candles: Candle[] = [];
  let price = 100;
  for (let i = 0; i < 30; i++) { candles.push(mkCandle(price, price + 10, price, price + 5, 100)); price += 5; }
  const atr = calculateATR(candles, 14);
  assert(atr.slice(0, 14).every(v => isNaN(v)), 'ATR 은 warm-up(기간 이전) 구간에서 NaN');
  assert(isFinite(atr[29]) && atr[29] > 0, 'ATR 은 기간 이후 유효값 산출');
}

// ── 3. 포지션 크기 · 손절 · 부분청산 · 수수료 (엔드투엔드) ───────────────────────
console.log('\n[3] 백테스트 회계 정합성');
{
  const candles = generateMockCandles(1000, cfg, 7);
  const res = runBacktest(candles, cfg);
  const rep = res.report;

  assert(res.elephantCount > 0, `엘리펀트 캔들이 탐지됨 (${res.elephantCount}개)`);

  // 승/패 합 = 총 거래
  assert(rep.winCount + rep.lossCount === rep.totalTrades, '승 + 패 = 총 거래 수');

  // 잔고 = 초기 + 순손익
  assert(approx(rep.finalBalance, rep.initialBalance + rep.netProfit, 1),
    '최종 자산 = 초기 자본 + 순손익');

  // 수수료 차감 전 ≥ 순손익 (수수료는 항상 비용)
  assert(rep.grossProfit >= rep.netProfit - 1, '수수료 차감 전 총손익 ≥ 순손익');
  assert(rep.totalFees >= 0, '총 수수료 ≥ 0');

  // 거래당 위험비율 준수: 손절 트레이드의 손실이 계좌의 riskPerTrade% 를 크게 넘지 않음
  const riskCap = rep.initialBalance * (cfg.riskPerTradePct / 100) * 1.5; // 슬리피지·버퍼 여유
  const worstStop = Math.min(0, ...res.trades.filter(t => t.reason === 'stop').map(t => t.netPnl));
  assert(Math.abs(worstStop) <= riskCap, `단일 손절 손실이 위험한도 이내 (worst=${worstStop.toFixed(0)}, cap≈${riskCap.toFixed(0)})`);

  // R 배수 부호와 순손익 부호 일관성
  const consistent = res.trades.every(t => (t.rMultiple >= 0) === (t.netPnl + t.fees >= 0) || Math.abs(t.rMultiple) < 0.02);
  assert(consistent, 'R 배수 부호와 총손익(gross) 부호 일관');

  console.log(`     └ 거래 ${rep.totalTrades}회 · 승률 ${rep.winRate.toFixed(1)}% · PF ${rep.profitFactor === Infinity ? '∞' : rep.profitFactor.toFixed(2)} · 수익 ${rep.cumReturnPct.toFixed(2)}%`);
}

// ── 4. 결정성 (같은 데이터·설정 → 같은 결과) ────────────────────────────────────
console.log('\n[4] 결정성(재현 가능)');
{
  const a = runBacktest(generateMockCandles(1500, cfg, 99), cfg);
  const b = runBacktest(generateMockCandles(1500, cfg, 99), cfg);
  assert(JSON.stringify(a.report) === JSON.stringify(b.report), '동일 시드·설정 → 동일 성과 보고서');
  assert(a.trades.length === b.trades.length, '동일 시드·설정 → 동일 거래 수');

  const c = runBacktest(generateMockCandles(1500, cfg, 100), cfg);
  assert(JSON.stringify(a.report) !== JSON.stringify(c.report) || a.trades.length !== c.trades.length,
    '다른 시드 → 다른 결과 (목데이터가 시드에 반응)');
}

// ── 5. 미래참조 방지 · 필터 효과 ────────────────────────────────────────────────
console.log('\n[5] 진입 규칙');
{
  // 필터를 모두 끄면 진입 기회가 늘어난다 (또는 최소한 줄지 않는다)
  const strict = runBacktest(generateMockCandles(2000, cfg, 3), cfg);
  const loose = runBacktest(generateMockCandles(2000, cfg, 3), {
    ...cfg, useEma200Filter: false, useEma20Slope: false, useVolumeFilter: false,
  });
  assert(loose.report.totalTrades >= strict.report.totalTrades,
    `필터 완화 시 거래 수 증가/유지 (strict=${strict.report.totalTrades}, loose=${loose.report.totalTrades})`);
}

// ── 결과 ───────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`  통과 ${passed} · 실패 ${failed}`);
if (failed > 0) { console.error('  ❌ 일부 검증 실패'); process.exit(1); }
else console.log('  ✅ 전체 통과');
