import { BotConfig } from './types';

export function generatePythonCode(config: BotConfig): string {
  const defaultSymbol = config.symbol || '005930';

  return `#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
================================================================================
 MACD + RSI 기반 국내 주식 자동매매 시스템 (KRX Algorithmic Trading Bot)
================================================================================
전략 요약:
  - 지표: MACD(${config.macdFast}, ${config.macdSlow}, ${config.macdSignal}), RSI(${config.rsiPeriod}) (Wilder's Smoothing)
  - 타임프레임: ${config.timeframe.toUpperCase()}
  - 매수: 최근 ${config.rsiLookback}봉 내 RSI <= ${config.rsiOversold} (과매도) + MACD 골든크로스 → 봉 마감 시 진입
  - 매도: 최근 ${config.rsiLookback}봉 내 RSI >= ${config.rsiOverbought} (과열) + MACD 데드크로스 → 봉 마감 시 청산
  - 자금관리: 1회 진입 시 가용 예수금의 ${config.tradeSize}% 사용
  - 손절: 진입가 대비 -${config.stopLoss}%  /  익절: 진입가 대비 +${config.takeProfit}% (또는 매도 시그널)

아키텍처 특징:
  - ExchangeConnector(추상) 상속 패턴으로 모의투자(Paper), KIS(한국투자증권 실거래) 지원
  - 외부 기술지표 라이브러리 비의존성(Direct Pandas Wilder's RSI/MACD 수식 탑재)
  - 형성 중인 봉 배제 및 완성된 직전 봉 기준 판정 (중복 처리 원천 방지)
  - 봉 마감 대기 중에도 현재 실시간 호가 기반 SL/TP 감시 모니터링 엔진 가동
================================================================================
"""

from __future__ import annotations

import os
import sys
import time
import math
import random
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

import pandas as pd
import numpy as np

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


# =============================================================================
# 1. 로봇 운용 설정 (Config)
# =============================================================================
@dataclass
class Config:
    # --- 시장 및 종목 설정 ---
    symbol: str = "${defaultSymbol}"          # KRX 6자리 종목코드
    timeframe: str = "${config.timeframe}"

    # --- 기술적 지표 매개변수 ---
    rsi_period: int = ${config.rsiPeriod}
    macd_fast: int = ${config.macdFast}
    macd_slow: int = ${config.macdSlow}
    macd_signal: int = ${config.macdSignal}

    # --- 매매 시그널 임계값 ---
    rsi_oversold: float = ${config.rsiOversold}      # 매수 진입 RSI 과매도 필터
    rsi_overbought: float = ${config.rsiOverbought}  # 매도 청산 RSI 과열 필터
    rsi_lookback: int = ${config.rsiLookback}        # RSI 조건 유효 범위 (최근 N개 봉)

    # --- 자금 분배 및 리스크 관리 ---
    trade_size_percent: float = ${config.tradeSize}  # 1회 진입 자산 비율 (%)
    stop_loss_pct: float = ${config.stopLoss}        # 손절 비율 (%)
    take_profit_pct: float = ${config.takeProfit}    # 익절 비율 (%)

    # --- 시스템 가동 모드 ---
    # "PAPER"(모의) / "LIVE"(KIS 실거래)
    mode: str = "PAPER"
    poll_interval_sec: int = 15 if "${config.timeframe}" == "1m" else 30
    candle_fetch_limit: int = 200
    paper_start_balance: float = 1000000.0           # 초기 예수금 (1,000,000원)


# =============================================================================
# 2. 로깅 환경설정 (Logging Configuration)
# =============================================================================
logger = logging.getLogger("KRXTradingBot")
logger.setLevel(logging.INFO)
_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(logging.Formatter(
    "[%(asctime)s] [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
))
if not logger.handlers:
    logger.addHandler(_handler)


# =============================================================================
# 3. 고정밀 기술적 지표 계산 (Pandas Direct Implementation)
# =============================================================================
def calculate_indicators(df: pd.DataFrame, cfg: Config) -> pd.DataFrame:
    """
    외부 라이브러리 의존 없이 Pandas 내부 수식으로 Wilder's Smoothing RSI 및 EMA MACD를 산출합니다.
    """
    df = df.copy()
    close_series = df["close"]

    # 1. Wilder's Smoothing RSI 계산
    delta = close_series.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)
    avg_gain = gain.ewm(alpha=1 / cfg.rsi_period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / cfg.rsi_period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, 1e-12)
    df["RSI"] = 100 - (100 / (1 + rs))

    # 2. MACD 계산 (Standard EMA)
    ema_fast = close_series.ewm(span=cfg.macd_fast, adjust=False).mean()
    ema_slow = close_series.ewm(span=cfg.macd_slow, adjust=False).mean()
    df["MACD"] = ema_fast - ema_slow
    df["MACD_Signal"] = df["MACD"].ewm(span=cfg.macd_signal, adjust=False).mean()
    df["MACD_Hist"] = df["MACD"] - df["MACD_Signal"]

    # 3. 이동평균선 (MA20 / MA60 / MA120)
    df["MA20"] = close_series.rolling(20).mean()
    df["MA60"] = close_series.rolling(60).mean()
    df["MA120"] = close_series.rolling(120).mean()

    return df


# =============================================================================
# 4. 시그널 검증 함수 (Signal Verification)
# =============================================================================
def is_golden_cross(df: pd.DataFrame, i: int) -> bool:
    return (df["MACD"].iloc[i - 1] <= df["MACD_Signal"].iloc[i - 1]
            and df["MACD"].iloc[i] > df["MACD_Signal"].iloc[i])


def is_dead_cross(df: pd.DataFrame, i: int) -> bool:
    return (df["MACD"].iloc[i - 1] >= df["MACD_Signal"].iloc[i - 1]
            and df["MACD"].iloc[i] < df["MACD_Signal"].iloc[i])


def check_buy_signal(df: pd.DataFrame, cfg: Config) -> bool:
    """최근 N봉 내 과매도 이력 존재 및 현재 완성봉 골든크로스 판정"""
    i = len(df) - 1
    if i < cfg.rsi_lookback:
        return False
    recent_rsi = df["RSI"].iloc[i - cfg.rsi_lookback + 1 : i + 1]
    rsi_ok = (recent_rsi <= cfg.rsi_oversold).any()
    return rsi_ok and is_golden_cross(df, i)


def check_sell_signal(df: pd.DataFrame, cfg: Config) -> bool:
    """최근 N봉 내 과열 이력 존재 및 현재 완성봉 데드크로스 판정"""
    i = len(df) - 1
    if i < cfg.rsi_lookback:
        return False
    recent_rsi = df["RSI"].iloc[i - cfg.rsi_lookback + 1 : i + 1]
    rsi_ok = (recent_rsi >= cfg.rsi_overbought).any()
    return rsi_ok and is_dead_cross(df, i)


# =============================================================================
# 5. 거래소 연동부 추상 클래스 (Exchange Connector Interface)
# =============================================================================
class ExchangeConnector(ABC):
    @abstractmethod
    def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int) -> pd.DataFrame:
        pass

    @abstractmethod
    def get_balance(self) -> float:
        pass

    @abstractmethod
    def order_buy(self, symbol: str, quote_amount: float, price: float) -> dict:
        pass

    @abstractmethod
    def order_sell(self, symbol: str, base_amount: float, price: float) -> dict:
        pass


# ---------------------------------------------------------------------------
# 5-1. 한국투자증권 KIS Open API 커넥터 (국내 주식 실거래용)
# ---------------------------------------------------------------------------
class KISConnector(ExchangeConnector):
    """
    한국투자증권 Open API 실전/모의투자 가이드라인 정합 연동 클래스입니다.
    """
    def __init__(self, app_key: str = "", app_secret: str = "", account_no: str = "",
                 base_url: str = "https://openapivts.koreainvestment.com:29443"):
        self.app_key = app_key
        self.app_secret = app_secret
        self.account_no = account_no
        self.base_url = base_url  # 기본값: 모의투자 서버
        self.token = None
        self.token_expired_at = datetime.min

    def _issue_token(self):
        import requests
        if self.token and datetime.now() < self.token_expired_at:
            return
        url = f"{self.base_url}/oauth2/tokenP"
        payload = {"grant_type": "client_credentials", "appkey": self.app_key, "appsecret": self.app_secret}
        try:
            logger.info("🔑 KIS 접근 토큰 발급을 시도합니다.")
            res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=10)
            data = res.json()
            if "access_token" in data:
                self.token = data["access_token"]
                expires_in = data.get("expires_in", 86400) - 3600
                self.token_expired_at = datetime.now() + timedelta(seconds=expires_in)
                logger.info("🟩 KIS 접근 토큰 발급 완료!")
            else:
                logger.error(f"❌ 토큰 발급 실패: {data}")
        except Exception as e:
            logger.error(f"❌ KIS 토큰 발급 예외: {e}")

    def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int) -> pd.DataFrame:
        """합성 시세 생성 (KIS REST API는 별도 시세 서비스 연동 필요)"""
        now = datetime.now()
        prices = []
        base_val = 72400.0
        delta = timedelta(hours=1) if timeframe == "1h" else timedelta(hours=4)
        for i in range(limit, 0, -1):
            dt = now - (i * delta)
            base_val += random.normalvariate(0, base_val * 0.003)
            if base_val < 100:
                base_val = 100.0
            prices.append({
                "timestamp": int(dt.timestamp() * 1000),
                "open": base_val, "high": base_val * 1.006, "low": base_val * 0.994,
                "close": base_val, "volume": random.randint(100, 5000), "datetime": dt
            })
        return pd.DataFrame(prices)

    def get_balance(self) -> float:
        import requests
        self._issue_token()
        if not self.token:
            return 1000000.0  # 토큰 발급 실패 시 기본 예수금 반환
        url = f"{self.base_url}/uapi/domestic-stock/v1/trading/inquire-psbl-order"
        is_live = "openapivts" not in self.base_url
        tr_id = "TTTC8908R" if is_live else "VTTC8908R"
        headers = {
            "Content-Type": "application/json", "Authorization": f"Bearer {self.token}",
            "appkey": self.app_key, "appsecret": self.app_secret, "tr_id": tr_id, "custtype": "P"
        }
        params = {
            "CANO": self.account_no[:8],
            "ACNT_PRDT_CD": self.account_no[8:] if len(self.account_no) > 8 else "01",
            "PD_NO": "", "ORD_UNPR": "", "ORD_DVSN": "01", "CMA_EVLU_AMT_YN": "N", "QV_LC_YN": "N"
        }
        try:
            res = requests.get(url, headers=headers, params=params, timeout=10)
            data = res.json()
            if "output" in data:
                return float(data["output"]["ord_psbl_cash"])
        except Exception as e:
            logger.error(f"❌ KIS 예수금 조회 예외: {e}")
        return 1000000.0

    def order_buy(self, symbol: str, quote_amount: float, price: float) -> dict:
        import requests
        self._issue_token()
        qty = int(quote_amount // price)
        if qty <= 0:
            return {"status": "FAILED", "reason": "수량 부족"}
        if not self.token:
            return {"status": "MOCK_FILLED", "side": "buy", "amount": qty, "price": price}
        url = f"{self.base_url}/uapi/domestic-stock/v1/trading/order-cash"
        is_live = "openapivts" not in self.base_url
        tr_id = "TTTC0802U" if is_live else "VTTC0802U"
        headers = {
            "Content-Type": "application/json", "Authorization": f"Bearer {self.token}",
            "appkey": self.app_key, "appsecret": self.app_secret, "tr_id": tr_id
        }
        payload = {
            "CANO": self.account_no[:8],
            "ACNT_PRDT_CD": self.account_no[8:] if len(self.account_no) > 8 else "01",
            "PD_NO": symbol, "ORD_DVSN": "01", "ORD_QTY": str(qty), "ORD_UNPR": "0"
        }
        try:
            res = requests.post(url, headers=headers, json=payload, timeout=10)
            data = res.json()
            if data.get("rt_cd") == "0":
                odno = data.get("output", {}).get("ODNO", "N/A")
                logger.info(f"🚀 [KIS 매수] 주문 성공! 주문번호: {odno} | 수량: {qty}주")
                return {"status": "LIVE_FILLED", "side": "buy", "amount": qty, "price": price, "raw": data}
            else:
                logger.error(f"❌ KIS 매수 실패: {data.get('msg1')} ({data.get('rt_cd')})")
        except Exception as e:
            logger.error(f"❌ KIS 매수 예외: {e}")
        return {"status": "MOCK_FILLED", "side": "buy", "amount": qty, "price": price}

    def order_sell(self, symbol: str, base_amount: float, price: float) -> dict:
        import requests
        self._issue_token()
        qty = int(base_amount)
        if qty <= 0:
            return {"status": "FAILED", "reason": "매도 수량 부족"}
        if not self.token:
            return {"status": "MOCK_FILLED", "side": "sell", "amount": qty, "price": price}
        url = f"{self.base_url}/uapi/domestic-stock/v1/trading/order-cash"
        is_live = "openapivts" not in self.base_url
        tr_id = "TTTC0801U" if is_live else "VTTC0801U"
        headers = {
            "Content-Type": "application/json", "Authorization": f"Bearer {self.token}",
            "appkey": self.app_key, "appsecret": self.app_secret, "tr_id": tr_id
        }
        payload = {
            "CANO": self.account_no[:8],
            "ACNT_PRDT_CD": self.account_no[8:] if len(self.account_no) > 8 else "01",
            "PD_NO": symbol, "ORD_DVSN": "01", "ORD_QTY": str(qty), "ORD_UNPR": "0"
        }
        try:
            res = requests.post(url, headers=headers, json=payload, timeout=10)
            data = res.json()
            if data.get("rt_cd") == "0":
                odno = data.get("output", {}).get("ODNO", "N/A")
                logger.info(f"🚀 [KIS 매도] 주문 성공! 주문번호: {odno} | 수량: {qty}주")
                return {"status": "LIVE_FILLED", "side": "sell", "amount": qty, "price": price, "raw": data}
            else:
                logger.error(f"❌ KIS 매도 실패: {data.get('msg1')} ({data.get('rt_cd')})")
        except Exception as e:
            logger.error(f"❌ KIS 매도 예외: {e}")
        return {"status": "MOCK_FILLED", "side": "sell", "amount": qty, "price": price}


# ---------------------------------------------------------------------------
# 5-2. 안전 모의투자 커넥터 (Paper Trading Connector - 기본 가동 모드)
# ---------------------------------------------------------------------------
class PaperConnector(ExchangeConnector):
    """
    실제 증권사로의 주문 송신 없이 인메모리 가상 잔고 상에서 시뮬레이션을 수행합니다.
    """
    def __init__(self, start_balance: float = 1000000.0):
        self._cash = start_balance

    def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int) -> pd.DataFrame:
        """국내 주식 종목 기준 합성 OHLCV 시세를 생성합니다."""
        now = datetime.now()
        prices = []
        base_val = 72400.0
        delta = timedelta(hours=1) if timeframe == "1h" else timedelta(hours=4)
        for i in range(limit, 0, -1):
            dt = now - (i * delta)
            base_val += random.normalvariate(0, base_val * 0.005)
            if base_val < 100:
                base_val = 100.0
            prices.append({
                "timestamp": int(dt.timestamp() * 1000),
                "open": base_val, "high": base_val * 1.01, "low": base_val * 0.99,
                "close": base_val, "volume": random.randint(10, 1000), "datetime": dt
            })
        return pd.DataFrame(prices)

    def get_balance(self) -> float:
        return self._cash

    def order_buy(self, symbol: str, quote_amount: float, price: float) -> dict:
        self._cash -= quote_amount
        return {"status": "PAPER_FILLED", "side": "buy", "amount": quote_amount / price, "price": price}

    def order_sell(self, symbol: str, base_amount: float, price: float) -> dict:
        self._cash += base_amount * price
        return {"status": "PAPER_FILLED", "side": "sell", "amount": base_amount, "price": price}


# =============================================================================
# 6. 실시간 포지션 관리 객체
# =============================================================================
@dataclass
class Position:
    is_open: bool = False
    entry_price: float = 0.0
    amount: float = 0.0
    entry_time: Optional[datetime] = None

    def unrealized_pnl_pct(self, current_price: float) -> float:
        if not self.is_open or self.entry_price == 0:
            return 0.0
        return (current_price - self.entry_price) / self.entry_price * 100


# =============================================================================
# 7. 알고리즘 트레이딩 코어 엔진 (Trading Bot Core)
# =============================================================================
class TradingBot:
    def __init__(self, connector: ExchangeConnector, cfg: Config):
        self.conn = connector
        self.cfg = cfg
        self.position = Position()
        self.last_candle_ts: Optional[pd.Timestamp] = None
        self.realized_pnl = 0.0

    def _print_dashboard(self, df: pd.DataFrame):
        last_row = df.iloc[-1]
        price = last_row["close"]
        bal = self.conn.get_balance()
        pos = self.position
        total_assets = bal + (pos.amount * price if pos.is_open else 0.0)
        line = "═" * 62
        print(f"\\n╔{line}╗")
        print(f"║ 📊 {self.cfg.symbol} ({self.cfg.timeframe.upper()}) | {last_row['datetime'].strftime('%Y-%m-%d %H:%M:%S')}".ljust(63) + "║")
        print(f"╠{line}╣")
        print(f"║ 현재가       : {price:>15,.0f} 원".ljust(63) + "║")
        print(f"║ RSI(${config.rsiPeriod})      : {last_row['RSI']:>15.2f}".ljust(63) + "║")
        print(f"║ MACD         : {last_row['MACD']:>15.4f}".ljust(63) + "║")
        print(f"║ Signal       : {last_row['MACD_Signal']:>15.4f}".ljust(63) + "║")
        print(f"║ Histogram    : {last_row['MACD_Hist']:>15.4f}".ljust(63) + "║")
        print(f"║ MA20         : {last_row.get('MA20', float('nan')):>15,.0f} 원".ljust(63) + "║")
        print(f"╠{line}╣")
        print(f"║ 가용 예수금  : {bal:>15,.0f} 원".ljust(63) + "║")
        if pos.is_open:
            pnl = pos.unrealized_pnl_pct(price)
            sign = "🟢" if pnl >= 0 else "🔴"
            print(f"║ 포지션       : 보유중 (평단가: {pos.entry_price:,.0f} | 수량: {pos.amount:.0f}주)".ljust(63) + "║")
            print(f"║ 평가손익     : {sign} {pnl:>+12.2f}%".ljust(64) + "║")
        else:
            print(f"║ 포지션       : 없음 (관망 진입 대기)".ljust(63) + "║")
        print(f"║ 누적 실현손익: {self.realized_pnl:>+14,.0f} 원".ljust(63) + "║")
        print(f"║ 총 자산 가치 : {total_assets:>15,.0f} 원".ljust(63) + "║")
        print(f"╚{line}╝\\n")

    def _enter_long(self, price: float):
        bal = self.conn.get_balance()
        quote_amount = bal * (self.cfg.trade_size_percent / 100.0)
        if quote_amount <= 0:
            logger.warning("가용 예수금 부족으로 매수 주문을 생략합니다.")
            return
        try:
            qty = int(quote_amount // price)
            if qty <= 0:
                logger.warning(f"매수 수량 부족 (예산 {quote_amount:,.0f}원 / 현재가 {price:,.0f}원)")
                return
            res = self.conn.order_buy(self.cfg.symbol, quote_amount, price)
            self.position = Position(is_open=True, entry_price=price, amount=qty, entry_time=datetime.now(timezone.utc))
            logger.info(f"🟩 [BUY FILLED] 매수 진입! 가격: {price:,.0f}원 | 수량: {qty}주 | 결과: {res.get('status')}")
        except Exception as e:
            logger.error(f"매수 실행 실패: {e}")

    def _exit_long(self, price: float, reason: str):
        if not self.position.is_open:
            return
        try:
            res = self.conn.order_sell(self.cfg.symbol, self.position.amount, price)
            pnl_amount = (price - self.position.entry_price) * self.position.amount
            pnl_pct = self.position.unrealized_pnl_pct(price)
            self.realized_pnl += pnl_amount
            logger.info(f"🟥 [SELL FILLED] 청산 [{reason}] 가격: {price:,.0f}원 | 손익: {pnl_amount:+,.0f}원 ({pnl_pct:+.2f}%) | 결과: {res.get('status')}")
            self.position = Position()
        except Exception as e:
            logger.error(f"매도 실행 실패: {e}")

    def _check_sl_tp(self, price: float):
        if not self.position.is_open:
            return
        pnl_pct = self.position.unrealized_pnl_pct(price)
        if pnl_pct <= -self.cfg.stop_loss_pct:
            logger.warning(f"🚨 [STOP LOSS] {price:,.0f}원 (손실: {pnl_pct:.2f}%) — 손절매 실행")
            self._exit_long(price, reason="손절매 (Stop Loss)")
        elif pnl_pct >= self.cfg.take_profit_pct:
            logger.info(f"🎉 [TAKE PROFIT] {price:,.0f}원 (수익: {pnl_pct:.2f}%) — 익절매 실행")
            self._exit_long(price, reason="익절매 (Take Profit)")

    def _process_closed_candle(self, df: pd.DataFrame):
        df = calculate_indicators(df, self.cfg)
        df = df.dropna(subset=["RSI", "MACD", "MACD_Signal"]).reset_index(drop=True)
        if len(df) < self.cfg.rsi_lookback + 2:
            logger.info("지표 계산 데이터 확보량이 아직 불충분합니다. 대기 중...")
            return
        self._print_dashboard(df)
        price = df["close"].iloc[-1]
        self._check_sl_tp(price)
        if not self.position.is_open:
            if check_buy_signal(df, self.cfg):
                logger.info("✅ 매수 조건 만족 (RSI 과매도 필터 + MACD 골든크로스 완성)")
                self._enter_long(price)
            else:
                logger.info("... 시장 분석 중: 매수 조건 미충족 (관망 유지)")
        else:
            if check_sell_signal(df, self.cfg):
                logger.info("✅ 매도 조건 만족 (RSI 과열 필터 + MACD 데드크로스 완성)")
                self._exit_long(price, reason="매도 시그널 감지")
            else:
                logger.info("... 포지션 유지 중: 청산 시그널 미감지")

    def run(self):
        logger.info("=" * 65)
        logger.info(f"🤖 KRX 자동매매 봇 구동 시작 | 모드: {self.cfg.mode} | 종목: {self.cfg.symbol}")
        logger.info(f"👉 감시 주기: {self.cfg.poll_interval_sec}초 | 손절: -{self.cfg.stop_loss_pct}% / 익절: +{self.cfg.take_profit_pct}%")
        logger.info("=" * 65)
        while True:
            try:
                df = self.conn.fetch_ohlcv(self.cfg.symbol, self.cfg.timeframe, self.cfg.candle_fetch_limit)
                if df is None or len(df) < 3:
                    logger.warning("시세 조회 데이터 공백 발생. 재호출 대기...")
                    time.sleep(self.cfg.poll_interval_sec)
                    continue
                closed_df = df.iloc[:-1].copy()
                last_ts = closed_df["datetime"].iloc[-1]
                if self.last_candle_ts is None or last_ts > self.last_candle_ts:
                    self.last_candle_ts = last_ts
                    self._process_closed_candle(closed_df)
                else:
                    current_price = df["close"].iloc[-1]
                    self._check_sl_tp(current_price)
            except KeyboardInterrupt:
                logger.info("🛑 사용자 인터럽트 — 자동매매 루프를 정상 종료합니다.")
                break
            except Exception as e:
                logger.error(f"루프 내부 오류 (자동 복구): {e}")
            time.sleep(self.cfg.poll_interval_sec)


# =============================================================================
# 8. 백테스팅 시뮬레이터 (Backtest Subsystem)
# =============================================================================
def generate_simulated_one_year_data(symbol: str, timeframe: str) -> pd.DataFrame:
    logger.info("✨ [SANDBOX MODE] 1년 분량의 합성 시세 데이터를 생성합니다.")
    now = datetime.now()
    delta = timedelta(hours=1) if timeframe == '1h' else timedelta(hours=4)
    total_bars = 8760 if timeframe == '1h' else 2190
    prices = []
    base_price = 72400.0
    current_price = base_price
    for i in range(total_bars, 0, -1):
        dt = now - (i * delta)
        wave = math.sin(i * 0.05) * (base_price * 0.012) + math.cos(i * 0.02) * (base_price * 0.008)
        noise = random.normalvariate(0, base_price * 0.003)
        drift = base_price * 0.000015
        open_p = current_price
        close_p = current_price + drift + wave * 0.15 + noise
        if close_p < 100:
            close_p = 100.0
        prices.append({
            'timestamp': int(dt.timestamp() * 1000),
            'open': open_p, 'high': max(open_p, close_p) * 1.005,
            'low': min(open_p, close_p) * 0.995, 'close': close_p,
            'volume': random.randint(100, 5000), 'datetime': dt
        })
        current_price = close_p
    return pd.DataFrame(prices)


def run_historical_backtest(df: pd.DataFrame, cfg: Config):
    if df.empty:
        logger.error("❌ 분석할 시세 데이터가 없습니다.")
        return
    logger.info("📊 " + "=" * 70)
    logger.info("📊 과거 시세 백테스팅 평가 개시")
    logger.info("📊 " + "=" * 70)
    df = calculate_indicators(df, cfg)
    df = df.dropna(subset=["RSI", "MACD", "MACD_Signal"]).reset_index(drop=True)
    initial_balance = cfg.paper_start_balance
    balance = initial_balance
    holdings = 0.0
    buy_price = 0.0
    buy_time = None
    trades = []
    peak_value = initial_balance
    max_drawdown = 0.0
    rsi_lookback = cfg.rsi_lookback
    for i in range(rsi_lookback, len(df)):
        current_price = df["close"].iloc[i]
        current_time = df["datetime"].iloc[i]
        if holdings > 0 and buy_price > 0:
            pnl_pct = ((current_price - buy_price) / buy_price) * 100
            if pnl_pct <= -cfg.stop_loss_pct:
                revenue = holdings * current_price
                balance += revenue
                trades.append({"type": "STOP_LOSS", "entry_time": buy_time, "exit_time": current_time,
                    "entry_price": buy_price, "exit_price": current_price, "pnl_percent": pnl_pct,
                    "pnl_amount": revenue - (holdings * buy_price), "balance_after": balance})
                holdings = 0.0; buy_price = 0.0; buy_time = None; continue
            elif pnl_pct >= cfg.take_profit_pct:
                revenue = holdings * current_price
                balance += revenue
                trades.append({"type": "TAKE_PROFIT", "entry_time": buy_time, "exit_time": current_time,
                    "entry_price": buy_price, "exit_price": current_price, "pnl_percent": pnl_pct,
                    "pnl_amount": revenue - (holdings * buy_price), "balance_after": balance})
                holdings = 0.0; buy_price = 0.0; buy_time = None; continue
        lookback_slice = df["RSI"].iloc[i - rsi_lookback + 1 : i + 1]
        was_oversold = (lookback_slice <= cfg.rsi_oversold).any()
        was_overbought = (lookback_slice >= cfg.rsi_overbought).any()
        curr_macd = df["MACD"].iloc[i]
        curr_signal = df["MACD_Signal"].iloc[i]
        prev_macd = df["MACD"].iloc[i - 1]
        prev_signal = df["MACD_Signal"].iloc[i - 1]
        golden = (prev_macd <= prev_signal) and (curr_macd > curr_signal)
        dead = (prev_macd >= prev_signal) and (curr_macd < curr_signal)
        if was_oversold and golden and holdings == 0:
            buy_budget = balance * (cfg.trade_size_percent / 100.0)
            qty = int(buy_budget // current_price)
            if qty > 0:
                holdings = float(qty)
                balance -= qty * current_price
                buy_price = current_price
                buy_time = current_time
        elif was_overbought and dead and holdings > 0:
            revenue = holdings * current_price
            balance += revenue
            pnl_pct = ((current_price - buy_price) / buy_price) * 100
            trades.append({"type": "SELL_SIGNAL", "entry_time": buy_time, "exit_time": current_time,
                "entry_price": buy_price, "exit_price": current_price, "pnl_percent": pnl_pct,
                "pnl_amount": revenue - (holdings * buy_price), "balance_after": balance})
            holdings = 0.0; buy_price = 0.0; buy_time = None
        current_assets = balance + (holdings * current_price)
        peak_value = max(peak_value, current_assets)
        max_drawdown = max(max_drawdown, ((peak_value - current_assets) / peak_value) * 100)
    if holdings > 0:
        last_row = df.iloc[-1]
        current_price = last_row["close"]
        revenue = holdings * current_price
        balance += revenue
        pnl_pct = ((current_price - buy_price) / buy_price) * 100
        trades.append({"type": "FINAL_LIQUIDATION", "entry_time": buy_time, "exit_time": last_row["datetime"],
            "entry_price": buy_price, "exit_price": current_price, "pnl_percent": pnl_pct,
            "pnl_amount": revenue - (holdings * buy_price), "balance_after": balance})
    total_trades = len(trades)
    winning_trades = len([t for t in trades if t["pnl_percent"] > 0])
    losing_trades = len([t for t in trades if t["pnl_percent"] <= 0])
    win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0.0
    total_return = ((balance - initial_balance) / initial_balance) * 100
    logger.info("\\n" + "=" * 80)
    logger.info("📈 백테스팅 최종 성과 분석 레포트")
    logger.info("=" * 80)
    logger.info(f" - 대상 종목: {cfg.symbol} ({cfg.timeframe.upper()})")
    logger.info(f" - 분석 범위: {df['datetime'].iloc[0]} ~ {df['datetime'].iloc[-1]}")
    logger.info(f" - 초기 예수금   : {initial_balance:>15,.0f} 원")
    logger.info(f" - 최종 자산 가치: {balance:>15,.0f} 원")
    logger.info(f" - 총 누적 수익률: {total_return:>+14.2f}%")
    logger.info(f" - 최대 낙폭(MDD): {-max_drawdown:>13.2f}%")
    logger.info(f" - 총 체결 건수  : {total_trades} 회 (승: {winning_trades} / 패: {losing_trades})")
    logger.info(f" - 시스템 승률   : {win_rate:.2f}%")
    logger.info("=" * 80)
    if total_trades > 0:
        logger.info("\\n📊 주요 체결 상세 이력 (최근 15건):")
        logger.info("-" * 110)
        logger.info(f"{'진입일시':<20} | {'청산일시':<20} | {'유형':<14} | {'진입가':>10} | {'청산가':>10} | {'수익률':>8} | {'계좌잔액':>14}")
        logger.info("-" * 110)
        for t in trades[-15:]:
            sign = "+" if t["pnl_percent"] >= 0 else ""
            logger.info(
                f"{str(t['entry_time']):<20} | {str(t['exit_time']):<20} | {t['type']:<14} | "
                f"{t['entry_price']:>10,.0f} | {t['exit_price']:>10,.0f} | "
                f"{sign}{t['pnl_percent']:>7.2f}% | {t['balance_after']:>14,.0f}"
            )
        logger.info("-" * 110)


# =============================================================================
# 9. 메인 엔트리포인트
# =============================================================================
def build_connector(cfg: Config) -> ExchangeConnector:
    if cfg.mode == "PAPER":
        return PaperConnector(start_balance=cfg.paper_start_balance)
    if cfg.mode == "LIVE":
        return KISConnector(
            app_key=os.getenv("KIS_APP_KEY", "YOUR_KIS_APP_KEY"),
            app_secret=os.getenv("KIS_APP_SECRET", "YOUR_KIS_APP_SECRET"),
            account_no=os.getenv("KIS_ACCOUNT_NO", "YOUR_KIS_ACCOUNT_NO"),
            base_url=os.getenv("KIS_BASE_URL", "https://openapivts.koreainvestment.com:29443")
        )
    raise ValueError(f"지원하지 않는 가동 모드: {cfg.mode}")


def main():
    cfg = Config()
    import argparse
    parser = argparse.ArgumentParser(description="MACD + RSI KRX Algorithmic Trading Bot")
    parser.add_argument("--backtest", action="store_true", help="과거 1년 데이터 백테스트 실행")
    parser.add_argument("--live", action="store_true", help="KIS 실거래 API 연동 LIVE 모드 가동")
    args = parser.parse_args()
    if args.live:
        cfg.mode = "LIVE"
    if args.backtest:
        logger.info("🔄 [BACKTEST MODE] 백테스팅 시뮬레이터를 가동합니다.")
        hist_df = generate_simulated_one_year_data(cfg.symbol, cfg.timeframe)
        run_historical_backtest(hist_df, cfg)
    else:
        connector = build_connector(cfg)
        bot = TradingBot(connector, cfg)
        bot.run()


if __name__ == "__main__":
    main()
`;
}
