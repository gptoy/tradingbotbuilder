import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldCheck, Terminal, Lock, RefreshCw, Play, Check, Copy,
  Info, CheckCircle2, Eye, EyeOff, Briefcase, Layers, Database,
  TrendingUp, TrendingDown, AlertTriangle, X, RotateCcw, Wallet,
  Package, Clock, ChevronDown, ChevronUp, Zap
} from 'lucide-react';

type Broker = 'kis' | 'kiwoom' | 'toss';
type KisSubTab = 'account' | 'trade' | 'history' | 'script';
type TossSubTab = 'account' | 'trade' | 'history' | 'script';
type ConnStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface TossHoldingItem {
  symbol: string;
  name: string;
  marketCountry: 'KR' | 'US';
  currency: 'KRW' | 'USD';
  quantity: string;
  lastPrice: string;
  averagePurchasePrice: string;
  profitLoss: { amount: string; amountAfterCost: string; rate: string; rateAfterCost: string };
  dailyProfitLoss: { amount: string; rate: string };
}

interface TossHoldingsOverview {
  totalPurchaseAmount: { krw: string; usd: string | null };
  marketValue: { amount: { krw: string; usd: string | null } };
  profitLoss: { amount: { krw: string; usd: string | null }; rate: string };
  items: TossHoldingItem[];
}

interface TossPriceItem {
  symbol: string;
  lastPrice: string;
  currency: 'KRW' | 'USD';
  timestamp: string | null;
}

interface TossOrder {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'LIMIT' | 'MARKET';
  status: string;
  price: string | null;
  quantity: string;
  currency: 'KRW' | 'USD';
  orderedAt: string;
  canceledAt: string | null;
  execution: {
    filledQuantity: string;
    averageFilledPrice: string | null;
    filledAmount: string | null;
    commission: string | null;
    tax: string | null;
    filledAt: string | null;
  };
}

interface HoldingItem {
  pdno: string;
  prdt_name: string;
  hldg_qty: string;
  pchs_avg_pric: string;
  evlu_pfls_amt: string;
  evlu_pfls_rt: string;
  prpr: string;
}

interface BalanceSummary {
  dnca_tot_amt: string;
  tot_evlu_amt: string;
  nass_amt: string;
  evlu_pfls_smtl_amt: string;
}

interface PriceInfo {
  stck_prpr: string;
  prdy_vrss: string;
  prdy_ctrt: string;
  acml_vol: string;
  stck_oprc: string;
  stck_hgpr: string;
  stck_lwpr: string;
  hts_kor_isnm: string;
}

interface TradeRecord {
  ord_dt: string;
  ord_tmd: string;
  sll_buy_dvsn_cd_name: string;
  pdno: string;
  prdt_name: string;
  ord_qty: string;
  avg_prvs: string;
  tot_ccld_amt: string;
  ccld_yn: string;
  odno: string;
}

interface PendingOrder {
  odno: string;
  ord_tmd: string;
  sll_buy_dvsn_cd_name: string;
  pdno: string;
  prdt_name: string;
  ord_qty: string;
  ord_unpr: string;
  rmn_qty: string;
  ord_dvsn_name: string;
  krx_fwdg_ord_orgno: string;
}

function fmt(numStr: string, decimals = 0): string {
  const n = parseFloat(numStr || '0');
  return isNaN(n) ? '0' : n.toLocaleString('ko-KR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function KisVerificationPanel() {
  const [activeBroker, setActiveBroker] = useState<Broker>('kis');
  const [kisSubTab, setKisSubTab] = useState<KisSubTab>('account');

  // ── KIS Credentials ───────────────────────────────────────────────────────
  const [kisAppKey, setKisAppKey]     = useState('');
  const [kisAppSecret, setKisAppSecret] = useState('');
  const [kisAccountNo, setKisAccountNo] = useState('');
  const [kisServerType, setKisServerType] = useState<'virtual' | 'real'>('virtual');
  const [showSecret, setShowSecret]   = useState(false);

  // ── Connection state ──────────────────────────────────────────────────────
  const [connStatus, setConnStatus]   = useState<ConnStatus>('disconnected');
  const [kisToken, setKisToken]       = useState('');
  const [tokenExpiry, setTokenExpiry] = useState<Date | null>(null);
  const [connError, setConnError]     = useState('');

  // ── Account data ──────────────────────────────────────────────────────────
  const [holdings, setHoldings]       = useState<HoldingItem[]>([]);
  const [balanceSummary, setBalanceSummary] = useState<BalanceSummary | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // ── Price lookup ──────────────────────────────────────────────────────────
  const [priceCode, setPriceCode]     = useState('005930');
  const [priceInfo, setPriceInfo]     = useState<PriceInfo | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const priceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Order state ───────────────────────────────────────────────────────────
  const [orderCode, setOrderCode]     = useState('005930');
  const [orderSide, setOrderSide]     = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType]     = useState<'01' | '00'>('01'); // 01=시장가, 00=지정가
  const [orderQty, setOrderQty]       = useState('1');
  const [orderPrice, setOrderPrice]   = useState('0');
  const [orderConfirm, setOrderConfirm] = useState(false);
  const [orderResult, setOrderResult] = useState<{ success: boolean; msg: string; odno?: string } | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);

  // ── History ───────────────────────────────────────────────────────────────
  const [tradeHistory, setTradeHistory] = useState<TradeRecord[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── Kiwoom mock state ────────────────────────────────────────────────────
  const [kiwoomAccountNo, setKiwoomAccountNo] = useState('');
  const [kiwoomPassword, setKiwoomPassword]   = useState('');
  const [kiwoomServerType, setKiwoomServerType] = useState<'virtual' | 'real'>('virtual');
  const [isTesting, setIsTesting]             = useState(false);
  const [testLogs, setTestLogs]               = useState<{ time: string; type: 'info' | 'success' | 'warning' | 'error'; message: string }[]>([]);
  const [testProgress, setTestProgress]       = useState(0);
  const [testResult, setTestResult]           = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [mockActiveTab, setMockActiveTab]     = useState<'interactive' | 'script'>('interactive');
  const [copied, setCopied]                   = useState(false);

  // ── Toss Real API state ───────────────────────────────────────────────────
  const [tossSubTab, setTossSubTab]           = useState<TossSubTab>('account');
  const [tossConnStatus, setTossConnStatus]   = useState<ConnStatus>('disconnected');
  const [tossClientId, setTossClientId]       = useState('');
  const [tossClientSecret, setTossClientSecret] = useState('');
  const [tossShowSecret, setTossShowSecret]   = useState(false);
  const [tossToken, setTossToken]             = useState('');
  const [tossTokenExpiry, setTossTokenExpiry] = useState<Date | null>(null);
  const [tossConnError, setTossConnError]     = useState('');
  const [tossAccountSeq, setTossAccountSeq]   = useState<number | null>(null);
  const [tossAccountNoDisplay, setTossAccountNoDisplay] = useState('');
  const [tossHoldingsData, setTossHoldingsData] = useState<TossHoldingsOverview | null>(null);
  const [tossBuyingPowerKrw, setTossBuyingPowerKrw] = useState('0');
  const [tossBuyingPowerUsd, setTossBuyingPowerUsd] = useState('0');
  const [tossLoadingBalance, setTossLoadingBalance] = useState(false);
  const [tossPriceSymbol, setTossPriceSymbol] = useState('005930');
  const [tossPriceData, setTossPriceData]     = useState<TossPriceItem | null>(null);
  const [tossLoadingPrice, setTossLoadingPrice] = useState(false);
  const tossPriceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tossOrderSymbol, setTossOrderSymbol] = useState('005930');
  const [tossOrderSide, setTossOrderSide]     = useState<'BUY' | 'SELL'>('BUY');
  const [tossOrderType, setTossOrderType]     = useState<'LIMIT' | 'MARKET'>('MARKET');
  const [tossOrderQty, setTossOrderQty]       = useState('1');
  const [tossOrderPrice, setTossOrderPrice]   = useState('');
  const [tossOrderConfirm, setTossOrderConfirm] = useState(false);
  const [tossOrderResult, setTossOrderResult] = useState<{ success: boolean; msg: string; orderId?: string } | null>(null);
  const [tossPlacingOrder, setTossPlacingOrder] = useState(false);
  const [tossOpenOrders, setTossOpenOrders]   = useState<TossOrder[]>([]);
  const [tossClosedOrders, setTossClosedOrders] = useState<TossOrder[]>([]);
  const [tossLoadingHistory, setTossLoadingHistory] = useState(false);
  const [tossCopied, setTossCopied]           = useState(false);

  const cano      = kisAccountNo.slice(0, 8);
  const acntPrdtCd = kisAccountNo.length > 8 ? kisAccountNo.slice(8) : '01';

  const kisHeaders = () => ({
    'Content-Type': 'application/json',
    'x-kis-token': kisToken,
    'x-kis-appkey': kisAppKey,
    'x-kis-appsecret': kisAppSecret,
    'x-kis-server': kisServerType,
  });

  // ── Connect: issue access token ───────────────────────────────────────────
  const handleConnect = async () => {
    if (!kisAppKey || !kisAppSecret || !kisAccountNo) {
      setConnError('App Key, App Secret, 계좌번호를 모두 입력해주세요.');
      return;
    }
    setConnStatus('connecting');
    setConnError('');
    try {
      const res = await fetch('/api/kis/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appKey: kisAppKey, appSecret: kisAppSecret }),
      });
      const data = await res.json();
      if (data.access_token) {
        setKisToken(data.access_token);
        const expiry = new Date();
        expiry.setSeconds(expiry.getSeconds() + (data.expires_in ?? 86400));
        setTokenExpiry(expiry);
        setConnStatus('connected');
        // Auto-load balance after connecting
        await fetchBalance(data.access_token);
      } else {
        const msg = data.msg1 ?? data.error ?? JSON.stringify(data);
        setConnError(`토큰 발급 실패: ${msg}`);
        setConnStatus('error');
      }
    } catch (e) {
      setConnError(`네트워크 오류: ${String(e)}`);
      setConnStatus('error');
    }
  };

  const handleDisconnect = () => {
    setKisToken('');
    setTokenExpiry(null);
    setConnStatus('disconnected');
    setHoldings([]);
    setBalanceSummary(null);
    setPriceInfo(null);
    setTradeHistory([]);
    setPendingOrders([]);
    if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
  };

  // ── Fetch balance + holdings ──────────────────────────────────────────────
  const fetchBalance = useCallback(async (token?: string) => {
    const tok = token ?? kisToken;
    if (!tok) return;
    setLoadingBalance(true);
    try {
      const res = await fetch(
        `/api/kis/balance?cano=${cano}&acntPrdtCd=${acntPrdtCd}`,
        { headers: { ...kisHeaders(), 'x-kis-token': tok } },
      );
      const data = await res.json();
      if (data.output1) {
        setHoldings(data.output1 as HoldingItem[]);
        setBalanceSummary(data.output2 as BalanceSummary);
      } else {
        console.warn('[balance]', data.msg1 ?? data);
      }
    } catch (e) {
      console.error('[balance]', e);
    }
    setLoadingBalance(false);
  }, [kisToken, cano, acntPrdtCd, kisServerType]);

  // ── Price lookup (with auto-refresh every 5s when connected) ─────────────
  const fetchPrice = useCallback(async (code?: string) => {
    const c = code ?? priceCode;
    if (!kisToken || !c) return;
    setLoadingPrice(true);
    try {
      const res = await fetch(`/api/kis/price?code=${c}`, { headers: kisHeaders() });
      const data = await res.json();
      if (data.output) setPriceInfo(data.output as PriceInfo);
    } catch (e) {
      console.error('[price]', e);
    }
    setLoadingPrice(false);
  }, [kisToken, priceCode, kisServerType]);

  useEffect(() => {
    if (connStatus !== 'connected' || kisSubTab !== 'trade') return;
    fetchPrice();
    priceIntervalRef.current = setInterval(() => fetchPrice(), 5000);
    return () => { if (priceIntervalRef.current) clearInterval(priceIntervalRef.current); };
  }, [connStatus, kisSubTab, priceCode, fetchPrice]);

  // ── Place order ───────────────────────────────────────────────────────────
  const placeOrder = async () => {
    setPlacingOrder(true);
    setOrderConfirm(false);
    setOrderResult(null);
    try {
      const res = await fetch('/api/kis/order', {
        method: 'POST',
        headers: kisHeaders(),
        body: JSON.stringify({
          cano,
          acntPrdtCd,
          pdno: orderCode,
          ordDvsn: orderType,
          ordQty: parseInt(orderQty) || 1,
          ordUnpr: orderType === '00' ? parseInt(orderPrice) || 0 : 0,
          side: orderSide,
        }),
      });
      const data = await res.json();
      if (data.rt_cd === '0') {
        const odno = data.output?.ODNO ?? '';
        setOrderResult({ success: true, msg: `주문 접수 완료! 주문번호: ${odno}`, odno });
        await fetchBalance();
        await fetchHistory();
      } else {
        setOrderResult({ success: false, msg: data.msg1 ?? '주문 실패' });
      }
    } catch (e) {
      setOrderResult({ success: false, msg: String(e) });
    }
    setPlacingOrder(false);
  };

  // ── Cancel order ──────────────────────────────────────────────────────────
  const cancelOrder = async (order: PendingOrder) => {
    try {
      const res = await fetch('/api/kis/order', {
        method: 'DELETE',
        headers: kisHeaders(),
        body: JSON.stringify({
          cano,
          acntPrdtCd,
          orgOdno: order.odno,
          orgBrno: order.krx_fwdg_ord_orgno,
          ordDvsn: '00',
          ordQty: parseInt(order.rmn_qty),
        }),
      });
      const data = await res.json();
      if (data.rt_cd === '0') {
        await fetchHistory();
      } else {
        alert(`취소 실패: ${data.msg1}`);
      }
    } catch (e) {
      alert(String(e));
    }
  };

  // ── Trade / pending history ───────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    if (!kisToken) return;
    setLoadingHistory(true);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    try {
      const [ordRes, penRes] = await Promise.all([
        fetch(`/api/kis/orders?cano=${cano}&acntPrdtCd=${acntPrdtCd}&startDt=${today}&endDt=${today}`, { headers: kisHeaders() }),
        fetch(`/api/kis/pending?cano=${cano}&acntPrdtCd=${acntPrdtCd}`, { headers: kisHeaders() }),
      ]);
      const [ordData, penData] = await Promise.all([ordRes.json(), penRes.json()]);
      if (ordData.output1) setTradeHistory(ordData.output1 as TradeRecord[]);
      if (penData.output) setPendingOrders(penData.output as PendingOrder[]);
    } catch (e) {
      console.error('[history]', e);
    }
    setLoadingHistory(false);
  }, [kisToken, cano, acntPrdtCd, kisServerType]);

  useEffect(() => {
    if (connStatus === 'connected' && kisSubTab === 'history') {
      fetchHistory();
    }
  }, [connStatus, kisSubTab, fetchHistory]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Toss Real API functions
  // ═══════════════════════════════════════════════════════════════════════════

  const handleTossConnect = async () => {
    if (!tossClientId || !tossClientSecret) {
      setTossConnError('Client ID와 Client Secret을 입력해주세요.');
      return;
    }
    setTossConnStatus('connecting');
    setTossConnError('');
    try {
      const tokenRes = await fetch('/api/toss/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: tossClientId, clientSecret: tossClientSecret }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        setTossConnError(`토큰 발급 실패: ${tokenData.error_description ?? tokenData.error ?? JSON.stringify(tokenData)}`);
        setTossConnStatus('error');
        return;
      }
      const tok = tokenData.access_token as string;
      setTossToken(tok);
      const expiry = new Date();
      expiry.setSeconds(expiry.getSeconds() + (tokenData.expires_in ?? 86400));
      setTossTokenExpiry(expiry);

      const accRes = await fetch('/api/toss/accounts', { headers: { 'x-toss-token': tok } });
      const accData = await accRes.json();
      if (!accData.result?.[0]) {
        setTossConnError('계좌 정보를 불러올 수 없습니다.');
        setTossConnStatus('error');
        return;
      }
      const seq: number = accData.result[0].accountSeq;
      const no: string = accData.result[0].accountNo ?? String(seq);
      setTossAccountSeq(seq);
      setTossAccountNoDisplay(no);
      setTossConnStatus('connected');
      await fetchTossBalance(tok, seq);
    } catch (e) {
      setTossConnError(`네트워크 오류: ${String(e)}`);
      setTossConnStatus('error');
    }
  };

  const handleTossDisconnect = () => {
    setTossToken('');
    setTossTokenExpiry(null);
    setTossConnStatus('disconnected');
    setTossAccountSeq(null);
    setTossAccountNoDisplay('');
    setTossHoldingsData(null);
    setTossBuyingPowerKrw('0');
    setTossBuyingPowerUsd('0');
    setTossPriceData(null);
    setTossOpenOrders([]);
    setTossClosedOrders([]);
    if (tossPriceIntervalRef.current) clearInterval(tossPriceIntervalRef.current);
  };

  const fetchTossBalance = useCallback(async (token?: string, seq?: number | null) => {
    const tok = token ?? tossToken;
    const accSeq = seq !== undefined ? seq : tossAccountSeq;
    if (!tok || accSeq === null || accSeq === undefined) return;
    setTossLoadingBalance(true);
    const hdr = { 'x-toss-token': tok, 'x-toss-account-seq': String(accSeq) };
    try {
      const [holdRes, bpKrwRes, bpUsdRes] = await Promise.all([
        fetch('/api/toss/holdings', { headers: hdr }),
        fetch('/api/toss/buying-power?currency=KRW', { headers: hdr }),
        fetch('/api/toss/buying-power?currency=USD', { headers: hdr }),
      ]);
      const [holdData, bpKrw, bpUsd] = await Promise.all([holdRes.json(), bpKrwRes.json(), bpUsdRes.json()]);
      if (holdData.result) setTossHoldingsData(holdData.result as TossHoldingsOverview);
      if (bpKrw.result?.amount !== undefined) setTossBuyingPowerKrw(bpKrw.result.amount);
      if (bpUsd.result?.amount !== undefined) setTossBuyingPowerUsd(bpUsd.result.amount);
    } catch (e) {
      console.error('[toss balance]', e);
    }
    setTossLoadingBalance(false);
  }, [tossToken, tossAccountSeq]);

  const fetchTossPrice = useCallback(async (sym?: string) => {
    const s = sym ?? tossPriceSymbol;
    if (!tossToken || !s) return;
    setTossLoadingPrice(true);
    try {
      const res = await fetch(`/api/toss/prices?symbols=${encodeURIComponent(s)}`, {
        headers: { 'x-toss-token': tossToken },
      });
      const data = await res.json();
      if (data.result?.[0]) setTossPriceData(data.result[0] as TossPriceItem);
    } catch (e) {
      console.error('[toss price]', e);
    }
    setTossLoadingPrice(false);
  }, [tossToken, tossPriceSymbol]);

  useEffect(() => {
    if (tossConnStatus !== 'connected' || tossSubTab !== 'trade') return;
    fetchTossPrice();
    tossPriceIntervalRef.current = setInterval(() => fetchTossPrice(), 5000);
    return () => { if (tossPriceIntervalRef.current) clearInterval(tossPriceIntervalRef.current); };
  }, [tossConnStatus, tossSubTab, tossPriceSymbol, fetchTossPrice]);

  const fetchTossHistory = useCallback(async () => {
    if (!tossToken || tossAccountSeq === null) return;
    setTossLoadingHistory(true);
    const hdr = { 'x-toss-token': tossToken, 'x-toss-account-seq': String(tossAccountSeq) };
    try {
      const [openRes, filledRes] = await Promise.all([
        fetch('/api/toss/orders?status=OPEN', { headers: hdr }),
        fetch('/api/toss/orders?status=FILLED', { headers: hdr }),
      ]);
      const [openData, filledData] = await Promise.all([openRes.json(), filledRes.json()]);
      if (Array.isArray(openData.result)) setTossOpenOrders(openData.result as TossOrder[]);
      if (Array.isArray(filledData.result)) setTossClosedOrders(filledData.result as TossOrder[]);
    } catch (e) {
      console.error('[toss history]', e);
    }
    setTossLoadingHistory(false);
  }, [tossToken, tossAccountSeq]);

  useEffect(() => {
    if (tossConnStatus === 'connected' && tossSubTab === 'history') fetchTossHistory();
  }, [tossConnStatus, tossSubTab, fetchTossHistory]);

  const placeTossOrder = async () => {
    if (!tossToken || tossAccountSeq === null) return;
    setTossPlacingOrder(true);
    setTossOrderConfirm(false);
    setTossOrderResult(null);
    try {
      const body: Record<string, string> = {
        symbol: tossOrderSymbol,
        side: tossOrderSide,
        orderType: tossOrderType,
        quantity: tossOrderQty,
      };
      if (tossOrderType === 'LIMIT' && tossOrderPrice) body.price = tossOrderPrice;
      const res = await fetch('/api/toss/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-toss-token': tossToken,
          'x-toss-account-seq': String(tossAccountSeq),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const orderId = data.result?.orderId;
      if (orderId) {
        setTossOrderResult({ success: true, msg: `주문 접수 완료! 주문번호: ${orderId}`, orderId });
        await fetchTossBalance();
        await fetchTossHistory();
      } else {
        setTossOrderResult({ success: false, msg: data.error?.message ?? data.message ?? JSON.stringify(data) });
      }
    } catch (e) {
      setTossOrderResult({ success: false, msg: String(e) });
    }
    setTossPlacingOrder(false);
  };

  const cancelTossOrder = async (orderId: string) => {
    if (!tossToken || tossAccountSeq === null) return;
    try {
      const res = await fetch('/api/toss/order/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-toss-token': tossToken,
          'x-toss-account-seq': String(tossAccountSeq),
        },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (data.result) {
        await fetchTossHistory();
      } else {
        alert(`취소 실패: ${data.error?.message ?? JSON.stringify(data)}`);
      }
    } catch (e) {
      alert(String(e));
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MOCK: Kiwoom test simulation
  // ═══════════════════════════════════════════════════════════════════════════
  const runMockTest = () => {
    if (isTesting) return;
    if (!kiwoomAccountNo || !kiwoomPassword) {
      alert('키움증권 계좌번호와 비밀번호를 입력해주세요.');
      return;
    }
    setIsTesting(true);
    setTestResult('running');
    setTestProgress(5);
    setTestLogs([]);
    const ts = () => new Date().toTimeString().split(' ')[0];
    const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', delay: number) =>
      new Promise<void>(resolve => setTimeout(() => {
        setTestLogs(prev => [...prev, { time: ts(), type, message }]);
        resolve();
      }, delay));

    (async () => {
      await addLog('💻 키움증권 OpenAPI+ OCX ActiveX 샌드박스 탑재 완료', 'info', 100); setTestProgress(10);
      await addLog(`📡 접속 서버: ${kiwoomServerType === 'virtual' ? '모의투자 상시 서버' : '본 서버'}`, 'info', 300); setTestProgress(20);
      await addLog('🔑 [단계1] CommConnect() 호출 및 로그인 핸드셰이크...', 'info', 600); setTestProgress(35);
      await addLog('🟩 [성공] OpenAPI+ 자동 로그인 및 세션 동기화 완료!', 'success', 800); setTestProgress(55);
      await addLog(`  - 위탁계좌: ${kiwoomAccountNo}`, 'success', 50);
      await addLog('🔍 [단계2] OPW00018 계좌평가현황 TR 전송...', 'info', 700); setTestProgress(70);
      await addLog('🟩 [성공] OnReceiveTrData 수신 완료!', 'success', 600); setTestProgress(85);
      await addLog('  - 예수금: 12,500,000 원 / 총평가: 14,800,000 원', 'success', 50);
      await addLog('🚀 [단계3] SendOrder(삼성전자 005930, 1주 시장가)...', 'info', 700); setTestProgress(90);
      await addLog('🟩 [성공] 주문번호: 0841280 접수!', 'success', 600);
      await addLog('🎉 키움증권 OpenAPI+ 연동 규격 가상 검증 완료!', 'success', 400);
      setTestProgress(100);
      setTestResult('success');
      setIsTesting(false);
    })();
  };

  const getMockScript = () => `import sys
from PyQt5.QtWidgets import QApplication
from PyQt5.QAxContainer import QAxWidget

# 키움증권 OpenAPI+ (32비트 Windows 전용)
class KiwoomTester:
    def __init__(self):
        self.app = QApplication(sys.argv)
        self.ocx = QAxWidget("KHOPENAPI.KHOpenAPICtrl.1")
        self.ocx.OnEventConnect.connect(self._on_connect)
        self.ocx.OnReceiveTrData.connect(self._on_receive_tr_data)

    def login(self):
        self.ocx.dynamicCall("CommConnect()")
        self.app.exec_()

    def _on_connect(self, err_code):
        if err_code == 0:
            print("로그인 성공!")
            accs = self.ocx.dynamicCall("GetLoginInfo(QString)", "ACCNO")
            self.get_balance(accs.strip(';').split(';')[0])

    def get_balance(self, account_no):
        self.ocx.dynamicCall("SetInputValue(QString,QString)", "계좌번호", account_no)
        self.ocx.dynamicCall("SetInputValue(QString,QString)", "비밀번호", "${kiwoomPassword || 'YOUR_PW'}")
        self.ocx.dynamicCall("SetInputValue(QString,QString)", "비밀번호입력매체구분", "00")
        self.ocx.dynamicCall("SetInputValue(QString,QString)", "조회구분", "2")
        self.ocx.dynamicCall("CommRqData(QString,QString,int,QString)", "예수금조회", "opw00018", 0, "1000")

    def _on_receive_tr_data(self, scr_no, rq_name, tr_code, *args):
        if rq_name == "예수금조회":
            dep = self.ocx.dynamicCall("GetCommData(QString,QString,int,QString)", tr_code, rq_name, 0, "예수금").strip()
            print(f"예수금: {int(dep):,}원")
            self.app.exit()

if __name__ == "__main__":
    KiwoomTester().login()
`;

  // ═══════════════════════════════════════════════════════════════════════════
  // KIS Python Script (for "script" sub-tab)
  // ═══════════════════════════════════════════════════════════════════════════
  const kisScript = `import requests, os

APP_KEY    = "${kisAppKey || 'YOUR_APP_KEY'}"
APP_SECRET = "${kisAppSecret || 'YOUR_APP_SECRET'}"
ACCOUNT_NO = "${kisAccountNo || 'YOUR_ACCOUNT_10DIGITS'}"
BASE_URL   = "${kisServerType === 'real'
    ? 'https://openapi.koreainvestment.com:9443'
    : 'https://openapivts.koreainvestment.com:29443'}"
CANO       = ACCOUNT_NO[:8]
ACNT_PRDT  = ACCOUNT_NO[8:] if len(ACCOUNT_NO) > 8 else "01"
IS_LIVE    = "openapivts" not in BASE_URL

def get_token():
    res = requests.post(f"{BASE_URL}/oauth2/tokenP", json={
        "grant_type": "client_credentials",
        "appkey": APP_KEY,
        "appsecret": APP_SECRET,
    }, verify=False)
    data = res.json()
    assert "access_token" in data, f"토큰 발급 실패: {data}"
    print(f"[OK] 토큰 발급: {data['access_token'][:40]}...")
    return data["access_token"]

def get_price(token, code="005930"):
    headers = {
        "Authorization": f"Bearer {token}",
        "appkey": APP_KEY, "appsecret": APP_SECRET,
        "tr_id": "FHKST01010100", "custtype": "P",
    }
    res = requests.get(f"{BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price",
        params={"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": code},
        headers=headers, verify=False)
    out = res.json().get("output", {})
    print(f"[{code}] 현재가: {int(out.get('stck_prpr',0)):,}원 | "
          f"전일比: {out.get('prdy_ctrt',0)}%")
    return out

def get_balance(token):
    headers = {
        "Authorization": f"Bearer {token}",
        "appkey": APP_KEY, "appsecret": APP_SECRET,
        "tr_id": "TTTC8434R" if IS_LIVE else "VTTC8434R", "custtype": "P",
    }
    res = requests.get(f"{BASE_URL}/uapi/domestic-stock/v1/trading/inquire-balance",
        params={
            "CANO": CANO, "ACNT_PRDT_CD": ACNT_PRDT,
            "AFHR_FLPR_YN": "N", "OFL_YN": "", "INQR_DVSN": "02",
            "UNPR_DVSN": "01", "FUND_STTL_ICLD_YN": "N",
            "FNCG_AMT_AUTO_RDPT_YN": "N", "PRCS_DVSN": "00",
            "CTX_AREA_FK100": "", "CTX_AREA_NK100": "",
        }, headers=headers, verify=False)
    data = res.json()
    s = data.get("output2", {})
    print(f"[잔고] 예수금: {int(s.get('dnca_tot_amt',0)):,}원 | "
          f"총평가: {int(s.get('tot_evlu_amt',0)):,}원")
    return data

def place_order(token, code, qty, side="buy", ord_dvsn="01", price=0):
    tr_id = ("TTTC0802U" if IS_LIVE else "VTTC0802U") if side == "buy" \\
        else ("TTTC0801U" if IS_LIVE else "VTTC0801U")
    headers = {
        "Authorization": f"Bearer {token}",
        "appkey": APP_KEY, "appsecret": APP_SECRET,
        "tr_id": tr_id, "custtype": "P",
    }
    body = {
        "CANO": CANO, "ACNT_PRDT_CD": ACNT_PRDT,
        "PDNO": code, "ORD_DVSN": ord_dvsn,
        "ORD_QTY": str(qty), "ORD_UNPR": str(price),
    }
    res = requests.post(f"{BASE_URL}/uapi/domestic-stock/v1/trading/order-cash",
        json=body, headers=headers, verify=False)
    data = res.json()
    if data.get("rt_cd") == "0":
        print(f"[OK] 주문 접수! 주문번호: {data['output']['ODNO']}")
    else:
        print(f"[ERR] 주문 실패: {data.get('msg1')}")
    return data

if __name__ == "__main__":
    import urllib3; urllib3.disable_warnings()
    token = get_token()
    get_price(token, "005930")
    get_balance(token)
    # 시장가 매수 예시 (실행 전 주석 해제)
    # place_order(token, "005930", qty=1, side="buy", ord_dvsn="01")
`;

  // ═══════════════════════════════════════════════════════════════════════════
  // Toss Python script
  // ═══════════════════════════════════════════════════════════════════════════
  const tossScript = `import requests

CLIENT_ID = "${tossClientId || 'YOUR_CLIENT_ID'}"
CLIENT_SECRET = "${tossClientSecret || 'YOUR_CLIENT_SECRET'}"
BASE_URL = "https://openapi.tossinvest.com"

def get_token():
    res = requests.post(f"{BASE_URL}/oauth2/token", data={
        "grant_type": "client_credentials",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
    })
    data = res.json()
    assert "access_token" in data, f"토큰 발급 실패: {data}"
    print(f"[OK] 토큰: {data['access_token'][:40]}...")
    return data["access_token"]

def get_accounts(token):
    headers = {"Authorization": f"Bearer {token}"}
    return requests.get(f"{BASE_URL}/api/v1/accounts", headers=headers).json()["result"]

def get_price(token, symbol):
    headers = {"Authorization": f"Bearer {token}"}
    items = requests.get(f"{BASE_URL}/api/v1/prices?symbols={symbol}", headers=headers).json()["result"]
    if items:
        print(f"[{items[0]['symbol']}] {items[0]['lastPrice']} {items[0]['currency']}")
    return items

def get_holdings(token, account_seq):
    headers = {"Authorization": f"Bearer {token}", "X-Tossinvest-Account": str(account_seq)}
    return requests.get(f"{BASE_URL}/api/v1/holdings", headers=headers).json()["result"]

def get_buying_power(token, account_seq, currency="KRW"):
    headers = {"Authorization": f"Bearer {token}", "X-Tossinvest-Account": str(account_seq)}
    data = requests.get(f"{BASE_URL}/api/v1/buying-power?currency={currency}", headers=headers).json()["result"]
    print(f"[예수금] {currency}: {data['amount']}")
    return data

def place_order(token, account_seq, symbol, side, order_type, quantity, price=None):
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Tossinvest-Account": str(account_seq),
        "Content-Type": "application/json",
    }
    body = {"symbol": symbol, "side": side, "orderType": order_type, "quantity": str(quantity)}
    if order_type == "LIMIT" and price:
        body["price"] = str(price)
    data = requests.post(f"{BASE_URL}/api/v1/orders", json=body, headers=headers).json()
    if data.get("result", {}).get("orderId"):
        print(f"[OK] 주문 접수: {data['result']['orderId']}")
    else:
        print(f"[ERR] 주문 실패: {data}")
    return data

def cancel_order(token, account_seq, order_id):
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Tossinvest-Account": str(account_seq),
        "Content-Type": "application/json",
    }
    return requests.post(f"{BASE_URL}/api/v1/orders/{order_id}/cancel", json={}, headers=headers).json()

def get_orders(token, account_seq, status="OPEN"):
    headers = {"Authorization": f"Bearer {token}", "X-Tossinvest-Account": str(account_seq)}
    return requests.get(f"{BASE_URL}/api/v1/orders?status={status}", headers=headers).json()["result"]

if __name__ == "__main__":
    token = get_token()
    accounts = get_accounts(token)
    account_seq = accounts[0]["accountSeq"]
    print(f"[계좌] accountSeq={account_seq}")

    get_price(token, "005930")
    get_buying_power(token, account_seq, "KRW")

    holdings = get_holdings(token, account_seq)
    print(f"[보유] {len(holdings.get('items', []))}종목")

    # 시장가 매수 예시 (주석 해제 후 실행)
    # order = place_order(token, account_seq, "005930", "BUY", "MARKET", 1)
    # print(f"[주문] {order}")
`;

  // ═══════════════════════════════════════════════════════════════════════════
  // Render helpers
  // ═══════════════════════════════════════════════════════════════════════════
  const priceChange = priceInfo ? parseFloat(priceInfo.prdy_vrss ?? '0') : 0;
  const isUp = priceChange >= 0;

  const renderKisSubTabNav = () => (
    <div className="flex border-b border-slate-800 text-xs mb-5">
      {([
        ['account', 'Wallet', '잔고/보유주식'],
        ['trade',   'Zap',   '실거래 주문'],
        ['history', 'Clock', '체결/미체결'],
        ['script',  'Terminal', '파이썬 코드'],
      ] as [KisSubTab, string, string][]).map(([id, , label]) => (
        <button
          key={id}
          onClick={() => setKisSubTab(id)}
          className={`pb-2.5 px-4 font-bold transition border-b-2 cursor-pointer whitespace-nowrap ${
            kisSubTab === id
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const renderConnectionPanel = () => (
    <div className="space-y-4">
      {/* Server Type */}
      <div>
        <label className="block text-[11px] font-bold text-slate-400 mb-1.5">서버 구분</label>
        <div className="grid grid-cols-2 gap-2">
          {(['virtual', 'real'] as const).map(s => (
            <button key={s} onClick={() => { setKisServerType(s); handleDisconnect(); }}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                kisServerType === s
                  ? s === 'real'
                    ? 'bg-rose-600/10 border-rose-500 text-rose-400 font-bold'
                    : 'bg-emerald-600/10 border-emerald-500 text-emerald-400 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}>
              {s === 'virtual' ? '모의투자 (테스트)' : '실전투자 (실거래)'}
            </button>
          ))}
        </div>
        {kisServerType === 'real' && (
          <div className="mt-2 flex items-start gap-2 p-2 bg-rose-950/30 border border-rose-800/50 rounded-lg">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-rose-300 leading-relaxed">
              <strong>실전 서버</strong>에 연결합니다. 주문 시 실제 자금이 사용됩니다. 신중하게 진행하세요.
            </p>
          </div>
        )}
      </div>

      {/* Credentials */}
      <div>
        <label className="block text-[11px] font-bold text-slate-400 mb-1.5">App Key</label>
        <input type="text" value={kisAppKey} onChange={e => setKisAppKey(e.target.value)}
          placeholder="apiportal.koreainvestment.com에서 발급"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
      </div>
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="block text-[11px] font-bold text-slate-400">App Secret</label>
          <button onClick={() => setShowSecret(!showSecret)} className="text-[9px] text-emerald-400 flex items-center gap-1">
            {showSecret ? <><EyeOff className="h-2.5 w-2.5" />숨기기</> : <><Eye className="h-2.5 w-2.5" />보이기</>}
          </button>
        </div>
        <input type={showSecret ? 'text' : 'password'} value={kisAppSecret}
          onChange={e => setKisAppSecret(e.target.value)}
          placeholder="KIS App Secret"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
      </div>
      <div>
        <label className="block text-[11px] font-bold text-slate-400 mb-1.5">종합계좌번호 (10자리)</label>
        <input type="text" maxLength={10} value={kisAccountNo}
          onChange={e => setKisAccountNo(e.target.value.replace(/\D/g, ''))}
          placeholder="예: 5006789401"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        {kisAccountNo.length === 10 && (
          <p className="text-[10px] text-slate-500 mt-1">
            계좌: <span className="font-mono text-slate-300">{cano}</span>
            {' '}상품코드: <span className="font-mono text-slate-300">{acntPrdtCd}</span>
          </p>
        )}
      </div>

      {/* Connect Button */}
      <div className="pt-1">
        {connStatus === 'connected' ? (
          <button onClick={handleDisconnect}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center justify-center gap-2 cursor-pointer">
            <X className="h-4 w-4" />
            <span>연결 해제</span>
          </button>
        ) : (
          <button onClick={handleConnect} disabled={connStatus === 'connecting'}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              connStatus === 'connecting'
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40'
            }`}>
            {connStatus === 'connecting'
              ? <><RefreshCw className="h-4 w-4 animate-spin" /><span>토큰 발급 중...</span></>
              : <><Lock className="h-4 w-4" /><span>KIS API 연결 (토큰 발급)</span></>}
          </button>
        )}
        {connError && (
          <p className="text-[10px] text-rose-400 mt-2 p-2 bg-rose-950/30 rounded-lg border border-rose-800/40">{connError}</p>
        )}
      </div>

      {/* Security note */}
      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[10px] text-slate-400 space-y-1">
        <div className="flex items-center gap-1 font-bold text-amber-400">
          <Info className="h-3.5 w-3.5" /><span>보안 안내</span>
        </div>
        <p>모든 자격증명은 브라우저 메모리에만 유지되며, 로컬 Vite 프록시를 통해서만 KIS 서버로 전달됩니다. 외부 서버로는 전송되지 않습니다.</p>
      </div>
    </div>
  );

  const renderAccount = () => (
    <div className="space-y-4">
      {connStatus !== 'connected' ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-center space-y-3">
          <Database className="h-10 w-10 text-slate-700" />
          <p className="text-xs">왼쪽 패널에서 KIS API에 연결하면<br />계좌 잔고와 보유 주식이 표시됩니다.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-300">계좌 잔고 요약</h3>
            <button onClick={() => fetchBalance()} disabled={loadingBalance}
              className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 cursor-pointer">
              <RefreshCw className={`h-3 w-3 ${loadingBalance ? 'animate-spin' : ''}`} />
              새로고침
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['예수금', fmt(balanceSummary?.dnca_tot_amt ?? '0'), 'text-slate-200'],
              ['총평가금액', fmt(balanceSummary?.tot_evlu_amt ?? '0'), 'text-slate-200'],
              ['순자산', fmt(balanceSummary?.nass_amt ?? '0'), 'text-slate-200'],
              ['평가손익', fmt(balanceSummary?.evlu_pfls_smtl_amt ?? '0'),
                parseFloat(balanceSummary?.evlu_pfls_smtl_amt ?? '0') >= 0
                  ? 'text-emerald-400' : 'text-rose-400'],
            ].map(([label, val, cls]) => (
              <div key={label} className="bg-slate-950 rounded-xl p-3 border border-slate-800">
                <p className="text-[10px] text-slate-500 mb-1">{label}</p>
                <p className={`text-sm font-bold font-mono ${cls}`}>{val}원</p>
              </div>
            ))}
          </div>

          {/* Holdings */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 mb-2">보유 주식</h3>
            {holdings.length === 0 ? (
              <p className="text-[11px] text-slate-500 text-center py-6">보유 주식이 없습니다.</p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {holdings.filter(h => parseInt(h.hldg_qty) > 0).map((h, i) => {
                  const pnl = parseFloat(h.evlu_pfls_amt);
                  const pnlRt = parseFloat(h.evlu_pfls_rt);
                  return (
                    <div key={i} className="bg-slate-950 rounded-xl p-3 border border-slate-800 text-xs">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-slate-200">{h.prdt_name}</p>
                          <p className="text-slate-500 font-mono text-[10px]">{h.pdno}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-slate-200">{fmt(h.prpr)}원</p>
                          <p className={`text-[10px] font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {pnl >= 0 ? '+' : ''}{fmt(h.evlu_pfls_amt)}원 ({pnlRt.toFixed(2)}%)
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-4 mt-2 text-[10px] text-slate-500">
                        <span>보유: <b className="text-slate-300">{fmt(h.hldg_qty)}주</b></span>
                        <span>평균단가: <b className="text-slate-300">{fmt(h.pchs_avg_pric)}원</b></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  const renderTrade = () => (
    <div className="space-y-4">
      {connStatus !== 'connected' ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-center space-y-3">
          <Zap className="h-10 w-10 text-slate-700" />
          <p className="text-xs">KIS API에 연결 후 실거래 주문을 실행할 수 있습니다.</p>
        </div>
      ) : (
        <>
          {/* Price lookup */}
          <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-bold text-slate-300">실시간 시세 조회</span>
              <span className="ml-auto text-[9px] text-slate-500">5초마다 자동 갱신</span>
            </div>
            <div className="flex gap-2">
              <input type="text" value={priceCode}
                onChange={e => setPriceCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="종목코드"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              <button onClick={() => fetchPrice()} disabled={loadingPrice}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5">
                <RefreshCw className={`h-3 w-3 ${loadingPrice ? 'animate-spin' : ''}`} />
                조회
              </button>
            </div>
            {priceInfo && (
              <div className="mt-3 space-y-2">
                <div className="flex items-baseline gap-3">
                  <p className="text-xl font-bold font-mono text-slate-100">
                    {parseInt(priceInfo.stck_prpr || '0').toLocaleString()}원
                  </p>
                  <span className={`text-sm font-mono ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isUp ? '+' : ''}{priceChange.toLocaleString()}
                    ({priceInfo.prdy_ctrt}%)
                  </span>
                </div>
                {priceInfo.hts_kor_isnm && (
                  <p className="text-xs text-slate-400">{priceInfo.hts_kor_isnm}</p>
                )}
                <div className="grid grid-cols-4 gap-2 text-[10px] text-slate-500 pt-1">
                  <span>시: <b className="text-slate-300">{parseInt(priceInfo.stck_oprc||'0').toLocaleString()}</b></span>
                  <span>고: <b className="text-emerald-400">{parseInt(priceInfo.stck_hgpr||'0').toLocaleString()}</b></span>
                  <span>저: <b className="text-rose-400">{parseInt(priceInfo.stck_lwpr||'0').toLocaleString()}</b></span>
                  <span>거래량: <b className="text-slate-300">{parseInt(priceInfo.acml_vol||'0').toLocaleString()}</b></span>
                </div>
              </div>
            )}
          </div>

          {/* Order form */}
          <div className={`rounded-xl p-4 border ${
            kisServerType === 'real'
              ? 'bg-rose-950/10 border-rose-800/40'
              : 'bg-slate-950 border-slate-800'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <Zap className={`h-4 w-4 ${kisServerType === 'real' ? 'text-rose-400' : 'text-emerald-400'}`} />
              <span className="text-xs font-bold text-slate-300">
                주문 입력
                {kisServerType === 'real' && <span className="ml-2 text-rose-400 text-[10px] font-bold">[실전 서버 - 실제 자금 사용]</span>}
              </span>
            </div>

            <div className="space-y-3">
              {/* Stock code */}
              <div>
                <label className="text-[10px] text-slate-400 mb-1 block">종목코드</label>
                <input type="text" value={orderCode}
                  onChange={e => setOrderCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              </div>

              {/* Buy / Sell */}
              <div className="grid grid-cols-2 gap-2">
                {(['buy', 'sell'] as const).map(s => (
                  <button key={s} onClick={() => setOrderSide(s)}
                    className={`py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      orderSide === s
                        ? s === 'buy'
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                          : 'bg-rose-600/20 border-rose-500 text-rose-400'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}>
                    {s === 'buy' ? '매수 (BUY)' : '매도 (SELL)'}
                  </button>
                ))}
              </div>

              {/* Order type */}
              <div className="grid grid-cols-2 gap-2">
                {([['01', '시장가'], ['00', '지정가']] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setOrderType(v)}
                    className={`py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      orderType === v
                        ? 'bg-slate-800 border-slate-600 text-slate-200'
                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Qty + Price */}
              <div className={`grid gap-2 ${orderType === '00' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="text-[10px] text-slate-400 mb-1 block">수량 (주)</label>
                  <input type="number" min="1" value={orderQty} onChange={e => setOrderQty(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                </div>
                {orderType === '00' && (
                  <div>
                    <label className="text-[10px] text-slate-400 mb-1 block">지정가 (원)</label>
                    <input type="number" min="0" value={orderPrice} onChange={e => setOrderPrice(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                onClick={() => setOrderConfirm(true)}
                disabled={placingOrder || !orderCode || !orderQty}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  placingOrder
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : orderSide === 'buy'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}>
                {placingOrder
                  ? <><RefreshCw className="h-4 w-4 animate-spin" />주문 처리 중...</>
                  : <>{orderSide === 'buy' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {orderSide === 'buy' ? '매수' : '매도'} 주문 ({orderQty}주 · {orderType === '01' ? '시장가' : `${parseInt(orderPrice).toLocaleString()}원`})
                  </>}
              </button>
            </div>
          </div>

          {/* Order result */}
          {orderResult && (
            <div className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${
              orderResult.success
                ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-400'
                : 'bg-rose-950/30 border-rose-800/50 text-rose-400'
            }`}>
              {orderResult.success ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
              <span>{orderResult.msg}</span>
              <button onClick={() => setOrderResult(null)} className="ml-auto cursor-pointer"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-4">
      {connStatus !== 'connected' ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-center space-y-3">
          <Clock className="h-10 w-10 text-slate-700" />
          <p className="text-xs">KIS API 연결 후 오늘의 체결 내역과 미체결 주문을 볼 수 있습니다.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">오늘 거래 내역</span>
            <button onClick={fetchHistory} disabled={loadingHistory}
              className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 cursor-pointer">
              <RefreshCw className={`h-3 w-3 ${loadingHistory ? 'animate-spin' : ''}`} />새로고침
            </button>
          </div>

          {/* Pending orders */}
          <div>
            <p className="text-[11px] font-bold text-amber-400 mb-2 flex items-center gap-1">
              <Clock className="h-3 w-3" /> 미체결 주문 ({pendingOrders.length}건)
            </p>
            {pendingOrders.length === 0 ? (
              <p className="text-[10px] text-slate-500 pl-2">미체결 주문이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {pendingOrders.map((o, i) => (
                  <div key={i} className="bg-slate-950 rounded-lg p-2.5 border border-amber-800/30 text-[11px] flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-200">{o.prdt_name} <span className="text-slate-500 font-mono text-[10px]">{o.pdno}</span></p>
                      <p className="text-slate-400">
                        <span className={o.sll_buy_dvsn_cd_name === '매수' ? 'text-emerald-400' : 'text-rose-400'}>{o.sll_buy_dvsn_cd_name}</span>
                        {' '}{o.ord_dvsn_name} | 잔량: {parseInt(o.rmn_qty)}주
                        {o.ord_unpr !== '0' && ` @ ${parseInt(o.ord_unpr).toLocaleString()}원`}
                      </p>
                    </div>
                    <button onClick={() => cancelOrder(o)}
                      className="px-2 py-1 bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-rose-400 rounded-lg text-[10px] transition cursor-pointer flex items-center gap-1">
                      <X className="h-3 w-3" />취소
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trade history */}
          <div>
            <p className="text-[11px] font-bold text-slate-300 mb-2 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" /> 체결 내역 ({tradeHistory.length}건)
            </p>
            {tradeHistory.length === 0 ? (
              <p className="text-[10px] text-slate-500 pl-2">오늘 체결된 주문이 없습니다.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {tradeHistory.map((t, i) => (
                  <div key={i} className="bg-slate-950 rounded-lg p-2.5 border border-slate-800 text-[11px]">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-200">{t.prdt_name}</span>
                        <span className="text-slate-500 font-mono text-[10px] ml-1">{t.pdno}</span>
                      </div>
                      <span className={`font-bold ${t.sll_buy_dvsn_cd_name === '매수' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {t.sll_buy_dvsn_cd_name}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-1 text-slate-400 text-[10px]">
                      <span>{t.ord_tmd?.slice(0,2)}:{t.ord_tmd?.slice(2,4)}</span>
                      <span>체결: {parseInt(t.ord_qty).toLocaleString()}주</span>
                      <span>평균: {parseInt(t.avg_prvs||'0').toLocaleString()}원</span>
                      <span>금액: {parseInt(t.tot_ccld_amt||'0').toLocaleString()}원</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  const renderScript = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-300">KIS Open API 파이썬 코드 (자격증명 자동 삽입)</span>
        <button onClick={async () => {
          await navigator.clipboard.writeText(kisScript);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }} className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer">
          {copied ? <><Check className="h-3 w-3 text-emerald-400" /><span className="text-emerald-400">복사됨</span></> : <><Copy className="h-3 w-3" />코드 복사</>}
        </button>
      </div>
      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-auto max-h-[500px] p-4 font-mono text-[11px] text-slate-300">
        <pre className="whitespace-pre">
          {kisScript.split('\n').map((line, i) => (
            <div key={i} className="flex hover:bg-slate-900/50 py-0.5 rounded">
              <span className="inline-block w-6 text-right text-slate-700 select-none mr-4 flex-shrink-0">{i + 1}</span>
              <span>{line}</span>
            </div>
          ))}
        </pre>
      </div>
      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[10px] text-slate-400 space-y-1">
        <p className="font-bold text-slate-300 flex items-center gap-1"><Info className="h-3.5 w-3.5 text-amber-400" />실행 방법</p>
        <p>1. 위 코드를 복사해 <code className="text-amber-400">kis_trader.py</code>로 저장</p>
        <p>2. <code className="text-amber-400">pip install requests</code> 설치</p>
        <p>3. <code className="text-amber-400">python kis_trader.py</code> 실행</p>
        <p>4. 매매 주문은 <code className="text-amber-400">place_order()</code> 주석 해제 후 실행</p>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Toss render functions
  // ═══════════════════════════════════════════════════════════════════════════

  const renderTossSubTabNav = () => (
    <div className="flex border-b border-slate-800 text-xs mb-5">
      {(['account', 'trade', 'history', 'script'] as TossSubTab[]).map((id) => {
        const label = { account: '잔고/보유주식', trade: '실거래 주문', history: '체결/미체결', script: '파이썬 코드' }[id];
        return (
          <button key={id} onClick={() => setTossSubTab(id)}
            className={`pb-2.5 px-4 font-bold transition border-b-2 cursor-pointer whitespace-nowrap ${
              tossSubTab === id ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}>{label}</button>
        );
      })}
    </div>
  );

  const renderTossConnectionPanel = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-[11px] font-bold text-slate-400 mb-1.5">Client ID</label>
        <input type="text" value={tossClientId} onChange={e => setTossClientId(e.target.value)}
          placeholder="ts_cli_xxxxxxxxxxxxxxxxxxxxxxxx"
          disabled={tossConnStatus === 'connected'}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50" />
      </div>
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="block text-[11px] font-bold text-slate-400">Client Secret</label>
          <button onClick={() => setTossShowSecret(!tossShowSecret)} className="text-[9px] text-blue-400 flex items-center gap-1 cursor-pointer">
            {tossShowSecret ? <><EyeOff className="h-2.5 w-2.5" />숨기기</> : <><Eye className="h-2.5 w-2.5" />보이기</>}
          </button>
        </div>
        <input type={tossShowSecret ? 'text' : 'password'} value={tossClientSecret}
          onChange={e => setTossClientSecret(e.target.value)}
          placeholder="ts_sec_xxxxxxxxxxxxxxxxxxxxxxxx"
          disabled={tossConnStatus === 'connected'}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50" />
      </div>

      {tossConnStatus === 'connected' && tossAccountNoDisplay && (
        <div className="bg-blue-950/20 border border-blue-800/40 rounded-xl p-3">
          <p className="text-[10px] text-slate-400 mb-0.5">연결된 계좌</p>
          <p className="font-mono text-xs font-bold text-blue-300">{tossAccountNoDisplay}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">accountSeq: {tossAccountSeq}</p>
        </div>
      )}

      <div className="pt-1">
        {tossConnStatus === 'connected' ? (
          <button onClick={handleTossDisconnect}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center justify-center gap-2 cursor-pointer">
            <X className="h-4 w-4" /><span>연결 해제</span>
          </button>
        ) : (
          <button onClick={handleTossConnect} disabled={tossConnStatus === 'connecting'}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              tossConnStatus === 'connecting'
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-950/40'
            }`}>
            {tossConnStatus === 'connecting'
              ? <><RefreshCw className="h-4 w-4 animate-spin" /><span>연결 중...</span></>
              : <><Lock className="h-4 w-4" /><span>토스증권 API 연결</span></>}
          </button>
        )}
        {tossConnError && (
          <p className="text-[10px] text-rose-400 mt-2 p-2 bg-rose-950/30 rounded-lg border border-rose-800/40">{tossConnError}</p>
        )}
      </div>

      <div className="bg-slate-950 p-3 rounded-xl border border-rose-900/40 text-[10px] text-slate-400 space-y-1">
        <div className="flex items-center gap-1 font-bold text-rose-400">
          <AlertTriangle className="h-3.5 w-3.5" /><span>실전 전용 API</span>
        </div>
        <p>토스증권은 모의투자 서버가 없습니다. 연결 시 <strong className="text-rose-300">실제 계좌</strong>에 접근하며 주문 시 실제 자금이 사용됩니다.</p>
      </div>
      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[10px] text-slate-400 space-y-1">
        <div className="flex items-center gap-1 font-bold text-amber-400">
          <Info className="h-3.5 w-3.5" /><span>보안 안내</span>
        </div>
        <p>자격증명은 브라우저 메모리에만 유지되며, 로컬 Vite 프록시를 통해서만 Toss 서버로 전달됩니다.</p>
      </div>
    </div>
  );

  const renderTossAccount = () => (
    <div className="space-y-4">
      {tossConnStatus !== 'connected' ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-center space-y-3">
          <Database className="h-10 w-10 text-slate-700" />
          <p className="text-xs">왼쪽 패널에서 토스증권 API에 연결하면<br />계좌 잔고와 보유 주식이 표시됩니다.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-300">계좌 잔고</h3>
            <button onClick={() => fetchTossBalance()} disabled={tossLoadingBalance}
              className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer">
              <RefreshCw className={`h-3 w-3 ${tossLoadingBalance ? 'animate-spin' : ''}`} />새로고침
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
              <p className="text-[10px] text-slate-500 mb-1">KRW 예수금</p>
              <p className="text-sm font-bold font-mono text-slate-200">{fmt(tossBuyingPowerKrw)}원</p>
            </div>
            <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
              <p className="text-[10px] text-slate-500 mb-1">USD 예수금</p>
              <p className="text-sm font-bold font-mono text-slate-200">${fmt(tossBuyingPowerUsd, 2)}</p>
            </div>
            {tossHoldingsData && (
              <>
                <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
                  <p className="text-[10px] text-slate-500 mb-1">평가금액 (KRW)</p>
                  <p className="text-sm font-bold font-mono text-slate-200">{fmt(tossHoldingsData.marketValue.amount.krw)}원</p>
                </div>
                <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
                  <p className="text-[10px] text-slate-500 mb-1">총손익</p>
                  <p className={`text-sm font-bold font-mono ${parseFloat(tossHoldingsData.profitLoss.amount.krw) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {parseFloat(tossHoldingsData.profitLoss.amount.krw) >= 0 ? '+' : ''}{fmt(tossHoldingsData.profitLoss.amount.krw)}원
                    <span className="text-xs ml-1">({(parseFloat(tossHoldingsData.profitLoss.rate) * 100).toFixed(2)}%)</span>
                  </p>
                </div>
              </>
            )}
          </div>
          {tossHoldingsData && (
            <div>
              <h3 className="text-xs font-bold text-slate-300 mb-2">보유 주식 ({tossHoldingsData.items?.length ?? 0}종목)</h3>
              {!tossHoldingsData.items?.length ? (
                <p className="text-[11px] text-slate-500 text-center py-6">보유 주식이 없습니다.</p>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {tossHoldingsData.items.map((item, i) => {
                    const plRate = parseFloat(item.profitLoss.rate) * 100;
                    const plAmt = parseFloat(item.profitLoss.amount);
                    return (
                      <div key={i} className="bg-slate-950 rounded-xl p-3 border border-slate-800 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-slate-200">{item.name}</p>
                            <p className="text-slate-500 font-mono text-[10px]">{item.symbol} · {item.marketCountry}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-bold text-slate-200">
                              {item.currency === 'KRW' ? `${fmt(item.lastPrice)}원` : `$${parseFloat(item.lastPrice).toFixed(2)}`}
                            </p>
                            <p className={`text-[10px] font-mono ${plAmt >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {plAmt >= 0 ? '+' : ''}{item.currency === 'KRW' ? `${fmt(item.profitLoss.amount)}원` : `$${parseFloat(item.profitLoss.amount).toFixed(2)}`}
                              {' '}({plRate >= 0 ? '+' : ''}{plRate.toFixed(2)}%)
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-4 mt-2 text-[10px] text-slate-500">
                          <span>보유: <b className="text-slate-300">{item.quantity}주</b></span>
                          <span>평균: <b className="text-slate-300">
                            {item.currency === 'KRW' ? `${fmt(item.averagePurchasePrice)}원` : `$${parseFloat(item.averagePurchasePrice).toFixed(2)}`}
                          </b></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderTossTrade = () => (
    <div className="space-y-4">
      {tossConnStatus !== 'connected' ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-center space-y-3">
          <Zap className="h-10 w-10 text-slate-700" />
          <p className="text-xs">토스증권 API 연결 후 실거래 주문을 실행할 수 있습니다.</p>
        </div>
      ) : (
        <>
          <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              <span className="text-xs font-bold text-slate-300">시세 조회</span>
              <span className="ml-auto text-[9px] text-slate-500">5초마다 자동 갱신</span>
            </div>
            <div className="flex gap-2">
              <input type="text" value={tossPriceSymbol}
                onChange={e => setTossPriceSymbol(e.target.value.toUpperCase())}
                placeholder="005930 또는 AAPL"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <button onClick={() => fetchTossPrice()} disabled={tossLoadingPrice}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5">
                <RefreshCw className={`h-3 w-3 ${tossLoadingPrice ? 'animate-spin' : ''}`} />조회
              </button>
            </div>
            {tossPriceData && (
              <div className="mt-3">
                <p className="text-xl font-bold font-mono text-slate-100">
                  {tossPriceData.currency === 'KRW'
                    ? `${parseInt(tossPriceData.lastPrice).toLocaleString()}원`
                    : `$${parseFloat(tossPriceData.lastPrice).toFixed(2)}`}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">{tossPriceData.symbol}</p>
              </div>
            )}
          </div>

          <div className="bg-rose-950/10 border border-rose-800/40 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-rose-400" />
              <span className="text-xs font-bold text-slate-300">주문 입력 <span className="text-rose-400 text-[10px] font-bold">[실전 - 실제 자금 사용]</span></span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-400 mb-1 block">종목코드</label>
                <input type="text" value={tossOrderSymbol}
                  onChange={e => setTossOrderSymbol(e.target.value.toUpperCase())}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['BUY', 'SELL'] as const).map(s => (
                  <button key={s} onClick={() => setTossOrderSide(s)}
                    className={`py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      tossOrderSide === s
                        ? s === 'BUY' ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-rose-600/20 border-rose-500 text-rose-400'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}>
                    {s === 'BUY' ? '매수 (BUY)' : '매도 (SELL)'}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {([['MARKET', '시장가'], ['LIMIT', '지정가']] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setTossOrderType(v)}
                    className={`py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      tossOrderType === v ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                    }`}>{label}</button>
                ))}
              </div>
              <div className={`grid gap-2 ${tossOrderType === 'LIMIT' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="text-[10px] text-slate-400 mb-1 block">수량</label>
                  <input type="number" min="1" value={tossOrderQty} onChange={e => setTossOrderQty(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                {tossOrderType === 'LIMIT' && (
                  <div>
                    <label className="text-[10px] text-slate-400 mb-1 block">지정가</label>
                    <input type="number" min="0" value={tossOrderPrice} onChange={e => setTossOrderPrice(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                )}
              </div>
              <button onClick={() => setTossOrderConfirm(true)} disabled={tossPlacingOrder || !tossOrderSymbol || !tossOrderQty}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  tossPlacingOrder ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : tossOrderSide === 'BUY' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}>
                {tossPlacingOrder
                  ? <><RefreshCw className="h-4 w-4 animate-spin" />주문 처리 중...</>
                  : <>{tossOrderSide === 'BUY' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {tossOrderSide === 'BUY' ? '매수' : '매도'} ({tossOrderQty}주 · {tossOrderType === 'MARKET' ? '시장가' : '지정가'})</>}
              </button>
            </div>
          </div>

          {tossOrderResult && (
            <div className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${
              tossOrderResult.success ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-400' : 'bg-rose-950/30 border-rose-800/50 text-rose-400'
            }`}>
              {tossOrderResult.success ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
              <span>{tossOrderResult.msg}</span>
              <button onClick={() => setTossOrderResult(null)} className="ml-auto cursor-pointer"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderTossHistory = () => (
    <div className="space-y-4">
      {tossConnStatus !== 'connected' ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-center space-y-3">
          <Clock className="h-10 w-10 text-slate-700" />
          <p className="text-xs">토스증권 API 연결 후 주문 내역을 볼 수 있습니다.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">주문 내역</span>
            <button onClick={fetchTossHistory} disabled={tossLoadingHistory}
              className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer">
              <RefreshCw className={`h-3 w-3 ${tossLoadingHistory ? 'animate-spin' : ''}`} />새로고침
            </button>
          </div>
          <div>
            <p className="text-[11px] font-bold text-amber-400 mb-2 flex items-center gap-1">
              <Clock className="h-3 w-3" /> 미체결 주문 ({tossOpenOrders.length}건)
            </p>
            {tossOpenOrders.length === 0 ? (
              <p className="text-[10px] text-slate-500 pl-2">미체결 주문이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {tossOpenOrders.map((order, i) => (
                  <div key={i} className="bg-slate-950 rounded-lg p-2.5 border border-amber-800/30 text-[11px] flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-200">
                        {order.symbol}
                        <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-normal">{order.status}</span>
                      </p>
                      <p className="text-slate-400">
                        <span className={order.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>{order.side === 'BUY' ? '매수' : '매도'}</span>
                        {' '}{order.orderType === 'MARKET' ? '시장가' : '지정가'} | {order.quantity}주
                        {order.price && ` @ ${parseInt(order.price).toLocaleString()}원`}
                      </p>
                    </div>
                    <button onClick={() => cancelTossOrder(order.orderId)}
                      className="px-2 py-1 bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-rose-400 rounded-lg text-[10px] transition cursor-pointer flex items-center gap-1">
                      <X className="h-3 w-3" />취소
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-300 mb-2 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" /> 체결 내역 ({tossClosedOrders.length}건)
            </p>
            {tossClosedOrders.length === 0 ? (
              <p className="text-[10px] text-slate-500 pl-2">체결된 주문이 없습니다.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {tossClosedOrders.map((order, i) => (
                  <div key={i} className="bg-slate-950 rounded-lg p-2.5 border border-slate-800 text-[11px]">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-200">{order.symbol}</span>
                        <span className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded font-normal ${
                          order.status === 'FILLED' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-slate-800 text-slate-400'
                        }`}>{order.status}</span>
                      </div>
                      <span className={`font-bold ${order.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {order.side === 'BUY' ? '매수' : '매도'}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-1 text-slate-400 text-[10px]">
                      <span>수량: {order.quantity}주</span>
                      {order.execution.averageFilledPrice && (
                        <span>체결가: {parseFloat(order.execution.averageFilledPrice).toLocaleString()}{order.currency === 'KRW' ? '원' : '$'}</span>
                      )}
                      {order.execution.filledAmount && (
                        <span>금액: {parseFloat(order.execution.filledAmount).toLocaleString()}{order.currency === 'KRW' ? '원' : '$'}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  const renderTossScript = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-300">토스증권 Open API 파이썬 코드</span>
        <button onClick={async () => {
          await navigator.clipboard.writeText(tossScript);
          setTossCopied(true);
          setTimeout(() => setTossCopied(false), 2000);
        }} className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer">
          {tossCopied ? <><Check className="h-3 w-3 text-blue-400" /><span className="text-blue-400">복사됨</span></> : <><Copy className="h-3 w-3" />코드 복사</>}
        </button>
      </div>
      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-auto max-h-[500px] p-4 font-mono text-[11px] text-slate-300">
        <pre className="whitespace-pre">
          {tossScript.split('\n').map((line, i) => (
            <div key={i} className="flex hover:bg-slate-900/50 py-0.5 rounded">
              <span className="inline-block w-6 text-right text-slate-700 select-none mr-4 flex-shrink-0">{i + 1}</span>
              <span>{line}</span>
            </div>
          ))}
        </pre>
      </div>
      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[10px] text-slate-400 space-y-1">
        <p className="font-bold text-slate-300 flex items-center gap-1"><Info className="h-3.5 w-3.5 text-amber-400" />실행 방법</p>
        <p>1. 위 코드를 복사해 <code className="text-amber-400">toss_trader.py</code>로 저장</p>
        <p>2. <code className="text-amber-400">pip install requests</code> 설치</p>
        <p>3. <code className="text-amber-400">python toss_trader.py</code> 실행</p>
        <p>4. 매수 주문은 <code className="text-amber-400">place_order()</code> 주석 해제 후 실행</p>
      </div>
    </div>
  );

  // ── Order confirmation modal ───────────────────────────────────────────────
  const OrderConfirmModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className={`bg-slate-900 border rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl ${
        kisServerType === 'real' ? 'border-rose-700' : 'border-slate-700'
      }`}>
        <div className="flex items-center gap-2">
          <AlertTriangle className={`h-5 w-5 ${kisServerType === 'real' ? 'text-rose-400' : 'text-amber-400'}`} />
          <h3 className="text-sm font-bold text-slate-200">주문 확인</h3>
          {kisServerType === 'real' && (
            <span className="ml-auto text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/40 px-2 py-0.5 rounded-full font-bold">실전 서버</span>
          )}
        </div>

        <div className="bg-slate-950 rounded-xl p-4 space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-slate-400">종목코드</span><span className="font-bold font-mono text-slate-200">{orderCode}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">구분</span>
            <span className={`font-bold ${orderSide === 'buy' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {orderSide === 'buy' ? '매수' : '매도'}
            </span>
          </div>
          <div className="flex justify-between"><span className="text-slate-400">주문유형</span><span className="text-slate-200">{orderType === '01' ? '시장가' : '지정가'}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">수량</span><span className="font-bold text-slate-200">{parseInt(orderQty).toLocaleString()}주</span></div>
          {orderType === '00' && (
            <div className="flex justify-between"><span className="text-slate-400">지정가</span><span className="font-bold text-slate-200">{parseInt(orderPrice).toLocaleString()}원</span></div>
          )}
          <div className="flex justify-between"><span className="text-slate-400">서버</span>
            <span className={`font-bold ${kisServerType === 'real' ? 'text-rose-400' : 'text-emerald-400'}`}>
              {kisServerType === 'real' ? '실전투자' : '모의투자'}
            </span>
          </div>
        </div>

        {kisServerType === 'real' && (
          <p className="text-[10px] text-rose-300 bg-rose-950/30 border border-rose-800/40 rounded-lg p-2 leading-relaxed">
            실전 서버에서 실행됩니다. 실제 자금이 사용됩니다. 정말 주문하시겠습니까?
          </p>
        )}

        <div className="flex gap-2">
          <button onClick={() => setOrderConfirm(false)}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer">
            취소
          </button>
          <button onClick={placeOrder}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition cursor-pointer ${
              orderSide === 'buy'
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-rose-600 hover:bg-rose-500'
            }`}>
            {orderSide === 'buy' ? '매수 실행' : '매도 실행'}
          </button>
        </div>
      </div>
    </div>
  );

  const TossOrderConfirmModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-rose-700 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-rose-400" />
          <h3 className="text-sm font-bold text-slate-200">주문 확인</h3>
          <span className="ml-auto text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/40 px-2 py-0.5 rounded-full font-bold">실전 서버</span>
        </div>
        <div className="bg-slate-950 rounded-xl p-4 space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-slate-400">종목코드</span><span className="font-bold font-mono text-slate-200">{tossOrderSymbol}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">구분</span>
            <span className={`font-bold ${tossOrderSide === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>{tossOrderSide === 'BUY' ? '매수' : '매도'}</span>
          </div>
          <div className="flex justify-between"><span className="text-slate-400">주문유형</span><span className="text-slate-200">{tossOrderType === 'MARKET' ? '시장가' : '지정가'}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">수량</span><span className="font-bold text-slate-200">{tossOrderQty}주</span></div>
          {tossOrderType === 'LIMIT' && tossOrderPrice && (
            <div className="flex justify-between"><span className="text-slate-400">지정가</span><span className="font-bold text-slate-200">{parseInt(tossOrderPrice).toLocaleString()}원</span></div>
          )}
          <div className="flex justify-between"><span className="text-slate-400">서버</span><span className="font-bold text-rose-400">실전투자</span></div>
        </div>
        <p className="text-[10px] text-rose-300 bg-rose-950/30 border border-rose-800/40 rounded-lg p-2 leading-relaxed">
          실전 서버에서 실행됩니다. 실제 자금이 사용됩니다. 정말 주문하시겠습니까?
        </p>
        <div className="flex gap-2">
          <button onClick={() => setTossOrderConfirm(false)}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer">취소</button>
          <button onClick={placeTossOrder}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition cursor-pointer ${
              tossOrderSide === 'BUY' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
            }`}>
            {tossOrderSide === 'BUY' ? '매수 실행' : '매도 실행'}
          </button>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Connection status badge
  // ═══════════════════════════════════════════════════════════════════════════
  const StatusBadge = () => {
    const map = {
      disconnected: { color: 'text-slate-400', dot: 'bg-slate-500', label: '미연결' },
      connecting:   { color: 'text-amber-400',  dot: 'bg-amber-400 animate-pulse', label: '연결 중...' },
      connected:    { color: 'text-emerald-400', dot: 'bg-emerald-400 animate-pulse', label: `연결됨 · ${kisServerType === 'real' ? '실전' : '모의'}` },
      error:        { color: 'text-rose-400',    dot: 'bg-rose-500', label: '오류' },
    }[connStatus];
    return (
      <div className={`flex items-center gap-1.5 text-[10px] font-bold ${map.color}`}>
        <span className={`w-2 h-2 rounded-full ${map.dot}`}></span>
        {map.label}
        {connStatus === 'connected' && tokenExpiry && (
          <span className="text-slate-500 font-normal ml-1">
            (만료: {tokenExpiry.toTimeString().slice(0, 5)})
          </span>
        )}
      </div>
    );
  };

  const TossStatusBadge = () => {
    const map = {
      disconnected: { color: 'text-slate-400', dot: 'bg-slate-500', label: '미연결' },
      connecting:   { color: 'text-amber-400',  dot: 'bg-amber-400 animate-pulse', label: '연결 중...' },
      connected:    { color: 'text-blue-400',   dot: 'bg-blue-400 animate-pulse', label: '연결됨 · 실전' },
      error:        { color: 'text-rose-400',   dot: 'bg-rose-500', label: '오류' },
    }[tossConnStatus];
    return (
      <div className={`flex items-center gap-1.5 text-[10px] font-bold ${map.color}`}>
        <span className={`w-2 h-2 rounded-full ${map.dot}`}></span>
        {map.label}
        {tossConnStatus === 'connected' && tossTokenExpiry && (
          <span className="text-slate-500 font-normal ml-1">(만료: {tossTokenExpiry.toTimeString().slice(0, 5)})</span>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {orderConfirm && <OrderConfirmModal />}
      {tossOrderConfirm && <TossOrderConfirmModal />}

      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
            <ShieldCheck className="h-5 w-5" />
            <span>국내 주요 증권사 실거래 API 연동 센터</span>
          </div>
          <p className="text-xs text-slate-400">
            <strong>한국투자증권(KIS)</strong> — 실제 REST API 연동 (토큰 발급 · 잔고 조회 · 실시간 주문 · 체결 내역)
            <br />
            <strong>토스증권</strong> — 실제 REST API 연동 (OAuth2 · 잔고 조회 · 실시간 주문 · 체결 내역)
            <br />
            <strong>키움증권</strong> — 연동 규격 가상 검증 + 파이썬 스크립트 생성 (Windows 32bit 전용)
          </p>
        </div>
        <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-xl text-xs font-mono font-medium whitespace-nowrap self-start md:self-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          KIS + Toss 실거래 API 연동
        </div>
      </div>

      {/* Broker Tab Selector */}
      <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 gap-2">
        {([
          ['kis',    Database,  '한국투자증권 (KIS) 실거래 연동'],
          ['kiwoom', Layers,    '키움증권 (Kiwoom OpenAPI+)'],
          ['toss',   Briefcase, '토스증권 (Toss Securities)'],
        ] as [Broker, React.ElementType, string][]).map(([id, Icon, label]) => (
          <button key={id}
            onClick={() => { setActiveBroker(id); setTestResult('idle'); setTestLogs([]); }}
            className={`flex-1 py-3 px-4 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeBroker === id
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}>
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:block">{label}</span>
            <span className="sm:hidden">{id.toUpperCase()}</span>
          </button>
        ))}
      </div>

      {/* ── KIS: real API ─────────────────────────────────────────────────── */}
      {activeBroker === 'kis' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: connection settings */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800/80 rounded-2xl p-5 space-y-5">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">한국투자증권 연동</h3>
              </div>
              <StatusBadge />
            </div>
            {renderConnectionPanel()}
          </div>

          {/* Right: sub-tabs */}
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800/80 rounded-2xl p-5">
            {renderKisSubTabNav()}
            {kisSubTab === 'account'  && renderAccount()}
            {kisSubTab === 'trade'    && renderTrade()}
            {kisSubTab === 'history'  && renderHistory()}
            {kisSubTab === 'script'   && renderScript()}
          </div>
        </div>
      )}

      {/* ── Kiwoom: mock simulation ───────────────────────────────────────── */}
      {activeBroker === 'kiwoom' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800/80 rounded-2xl p-5 space-y-5">
            <div className="border-b border-slate-800 pb-3 flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">키움증권 연동 설정</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5">서버 구분</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['virtual', 'real'] as const).map(s => (
                    <button key={s} onClick={() => setKiwoomServerType(s)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        kiwoomServerType === s
                          ? s === 'real' ? 'bg-rose-600/10 border-rose-500 text-rose-400' : 'bg-emerald-600/10 border-emerald-500 text-emerald-400'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}>
                      {s === 'virtual' ? '모의투자 (테스트용)' : '실전투자 (실거래용)'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5">키움증권 계좌번호 (10자리)</label>
                <input type="text" maxLength={10} value={kiwoomAccountNo}
                  onChange={e => setKiwoomAccountNo(e.target.value.replace(/\D/g, ''))}
                  placeholder="예: 5012345610"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5">계좌 비밀번호 (4자리)</label>
                <input type="password" maxLength={4} value={kiwoomPassword}
                  onChange={e => setKiwoomPassword(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                <p className="text-[10px] text-slate-500 mt-1">키움 OpenAPI는 Windows 32비트 전용입니다.</p>
              </div>
              <div className="pt-3 border-t border-slate-800">
                <button onClick={runMockTest} disabled={isTesting}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    isTesting ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}>
                  {isTesting
                    ? <><RefreshCw className="h-4 w-4 animate-spin" /><span>검증 중... ({testProgress}%)</span></>
                    : <><Play className="h-4 w-4" /><span>연동 규격 가상 검증 실행</span></>}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col space-y-4">
            <div className="flex border-b border-slate-800 text-xs">
              {([['interactive', 'API 연동 터미널'], ['script', '파이썬 즉시 실행 코드']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setMockActiveTab(id)}
                  className={`pb-2.5 px-4 font-bold transition border-b-2 cursor-pointer ${
                    mockActiveTab === id ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}>{label}</button>
              ))}
            </div>
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl min-h-[380px] flex flex-col">
              {mockActiveTab === 'interactive' ? (
                <div className="flex-1 flex flex-col h-full">
                  <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex justify-between items-center text-[10px] font-mono text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      <span className="pl-2">kiwoom_handshake_tester.py</span>
                    </div>
                    <span>{testResult === 'success' ? 'CONNECTED' : testResult === 'running' ? 'TESTING' : 'IDLE'}</span>
                  </div>
                  <div className="flex-1 p-4 font-mono text-xs text-slate-300 space-y-2.5 overflow-y-auto max-h-[280px]">
                    {testLogs.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center space-y-2 py-10">
                        <Terminal className="h-10 w-10 text-slate-700 animate-pulse" />
                        <p className="text-xs">정보를 입력 후 <span className="text-emerald-400 font-bold">"연동 규격 가상 검증 실행"</span>을 클릭하세요.</p>
                      </div>
                    ) : testLogs.map((log, idx) => (
                      <div key={idx} className="flex items-start space-x-2 text-[11px]">
                        <span className="text-slate-600 flex-shrink-0">[{log.time}]</span>
                        <span className={log.type === 'success' ? 'text-emerald-400' : log.type === 'error' ? 'text-rose-400' : log.type === 'warning' ? 'text-amber-400' : 'text-slate-300'}>
                          {log.message}
                        </span>
                      </div>
                    ))}
                  </div>
                  {testResult === 'success' && (
                    <div className="p-4 bg-emerald-950/30 border-t border-emerald-900/40 flex items-center gap-3 text-xs text-emerald-400">
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                      <p>연동 규격 가상 검증 완료! "파이썬 즉시 실행 코드" 탭에서 스크립트를 복사하세요.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col h-full">
                  <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex justify-between items-center">
                    <span className="font-mono text-[11px] text-slate-300">test_kiwoom_api.py</span>
                    <button onClick={async () => {
                      await navigator.clipboard.writeText(getMockScript());
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer">
                      {copied ? <><Check className="h-3 w-3 text-emerald-400" /><span className="text-emerald-400">복사됨</span></> : <><Copy className="h-3 w-3" />코드 복사</>}
                    </button>
                  </div>
                  <div className="flex-1 p-4 font-mono text-[11px] text-slate-300 overflow-auto max-h-[300px]">
                    <pre>
                      {getMockScript().split('\n').map((line, idx) => (
                        <div key={idx} className="flex hover:bg-slate-900/50 py-0.5 rounded">
                          <span className="inline-block w-8 text-right text-slate-600 select-none mr-4">{idx + 1}</span>
                          <span>{line}</span>
                        </div>
                      ))}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toss: real API ────────────────────────────────────────────────── */}
      {activeBroker === 'toss' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800/80 rounded-2xl p-5 space-y-5">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-blue-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">토스증권 연동</h3>
              </div>
              <TossStatusBadge />
            </div>
            {renderTossConnectionPanel()}
          </div>
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800/80 rounded-2xl p-5">
            {renderTossSubTabNav()}
            {tossSubTab === 'account'  && renderTossAccount()}
            {tossSubTab === 'trade'    && renderTossTrade()}
            {tossSubTab === 'history'  && renderTossHistory()}
            {tossSubTab === 'script'   && renderTossScript()}
          </div>
        </div>
      )}

      {/* Setup checklist */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          {activeBroker === 'kis' && '한국투자증권 실거래 API 가입 절차'}
          {activeBroker === 'kiwoom' && '키움증권 OpenAPI+ 사전 준비 사항'}
          {activeBroker === 'toss' && '토스증권 OpenAPI 신청 절차'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {activeBroker === 'kis' && [
            ['01', 'KIS 개발자 포털 가입', 'apiportal.koreainvestment.com에서 실전/모의투자 가입. App Key와 App Secret 발급 (각각 모의/실전 별도).'],
            ['02', '계좌번호 확인', '주식위탁 계좌 10자리 확인. 뒷 2자리가 01이어야 국내주식 주문 가능.'],
            ['03', 'API 사용 신청', '개발자 포털에서 "국내주식주문" API 사용 동의. 모의투자용 API는 별도 URL 사용.'],
          ].map(([num, title, desc]) => (
            <div key={num} className="flex items-start gap-2.5">
              <span className="text-emerald-400 font-bold font-mono mt-0.5">{num}.</span>
              <div>
                <p className="font-semibold text-slate-200">{title}</p>
                <p className="text-slate-400 text-[11px] mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
          {activeBroker === 'kiwoom' && [
            ['01', 'OpenAPI+ 서비스 등록', '영웅문4 또는 키움 홈페이지에서 OpenAPI+ 이용 신청 및 모의투자 참가 활성화.'],
            ['02', 'KOA Studio 설치', '키움 개발 도구 KOA Studio를 설치해 TR 데이터 규격 확인. 32비트 Python 환경 필수.'],
            ['03', '32비트 가상환경 구성', 'Python 32비트 + PyQt5 + pywin32 설치. conda create -n kiwoom python=3.8 i386'],
          ].map(([num, title, desc]) => (
            <div key={num} className="flex items-start gap-2.5">
              <span className="text-emerald-400 font-bold font-mono mt-0.5">{num}.</span>
              <div><p className="font-semibold text-slate-200">{title}</p><p className="text-slate-400 text-[11px] mt-0.5">{desc}</p></div>
            </div>
          ))}
          {activeBroker === 'toss' && [
            ['01', '토스증권 개발자 센터', 'openapi.tossinvest.com에서 개발자 등록 및 OAuth2 Client ID / Client Secret 발급.'],
            ['02', '앱 승인 및 IP 등록', '최초 연결 시 토스 앱에서 기기 보안 승인 수락. 운영 환경은 공인 IP를 개발자 어드민에 등록.'],
            ['03', 'API 실거래 연결', '이 패널에서 Client ID/Secret 입력 후 "토스증권 API 연결" 클릭. 계좌는 자동 조회됩니다.'],
          ].map(([num, title, desc]) => (
            <div key={num} className="flex items-start gap-2.5">
              <span className="text-emerald-400 font-bold font-mono mt-0.5">{num}.</span>
              <div><p className="font-semibold text-slate-200">{title}</p><p className="text-slate-400 text-[11px] mt-0.5">{desc}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
