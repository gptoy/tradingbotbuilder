import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import https from 'https';
import path from 'path';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';

/** Fetch from Naver Finance with browser-like headers to avoid blocking */
function naverGet(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          Referer: 'https://finance.naver.com/',
          Accept: 'application/json, text/html, */*',
          'Accept-Language': 'ko-KR,ko;q=0.9',
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      },
    ).on('error', reject);
  });
}

/** Fetch from Yahoo Finance — no Naver-specific headers */
function yahooGet(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          Accept: 'application/json, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
        },
      },
      (res) => {
        // Follow redirect (Yahoo sometimes 301-redirects)
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          yahooGet(res.headers.location as string).then(resolve).catch(reject);
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      },
    ).on('error', reject);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// US Stock (NASDAQ/NYSE) Proxy Plugin
// Routes /api/us-stock/* → Yahoo Finance (CORS-free server-side)
// ─────────────────────────────────────────────────────────────────────────────
function usStockPlugin(): Plugin {
  return {
    name: 'us-stock-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/us-stock/')) { next(); return; }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const sendErr = (code: number, msg: string) => {
          res.statusCode = code;
          res.end(JSON.stringify({ error: msg }));
        };

        try {
          // ── GET /api/us-stock/batch/quotes?symbols=AAPL,MSFT,… ──────────
          // Batch current prices for multiple symbols
          if (url.startsWith('/api/us-stock/batch/quotes')) {
            const qp  = new URLSearchParams(url.split('?')[1] ?? '');
            const syms = qp.get('symbols') ?? '';
            if (!syms) { sendErr(400, 'symbols required'); return; }

            const yahooUrl = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(syms)}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,preMarketPrice,postMarketPrice`;
            const buf  = await yahooGet(yahooUrl);
            const data = JSON.parse(buf.toString('utf-8'));
            const results = data?.quoteResponse?.result ?? [];

            const prices: Record<string, number> = {};
            for (const q of results) {
              const sym = q.symbol as string;
              // Use post-market or pre-market price if regular market is closed
              const price = (q.regularMarketPrice as number)
                ?? (q.postMarketPrice as number)
                ?? (q.preMarketPrice as number)
                ?? 0;
              if (price > 0) prices[sym] = price;
            }
            res.end(JSON.stringify(prices));
            return;
          }

          // ── GET /api/us-stock/:symbol/candles?count=N ────────────────────
          // Daily OHLCV bars from Yahoo Finance chart API
          const candleMatch = url.match(/^\/api\/us-stock\/([^/?]+)\/candles/);
          if (candleMatch) {
            const symbol = decodeURIComponent(candleMatch[1]).toUpperCase();
            const qp    = new URLSearchParams(url.split('?')[1] ?? '');
            const count = Math.min(Math.max(Number(qp.get('count') ?? '200'), 60), 500);
            const range = count <= 80 ? '6mo' : count <= 160 ? '1y' : '2y';

            const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}&includePrePost=false`;
            const buf  = await yahooGet(yahooUrl);
            const data = JSON.parse(buf.toString('utf-8'));
            const result = data?.chart?.result?.[0];
            if (!result) { sendErr(404, `No Yahoo Finance data for ${symbol}`); return; }

            const timestamps: number[]    = result.timestamp ?? [];
            const quote = result.indicators?.quote?.[0] ?? {};
            const opens:   (number|null)[] = quote.open   ?? [];
            const highs:   (number|null)[] = quote.high   ?? [];
            const lows:    (number|null)[] = quote.low    ?? [];
            const closes:  (number|null)[] = quote.close  ?? [];
            const volumes: (number|null)[] = quote.volume ?? [];

            const candles = timestamps
              .map((ts, i) => {
                const d = new Date(ts * 1000);
                const year  = d.getUTCFullYear();
                const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                const day   = String(d.getUTCDate()).padStart(2, '0');
                const close = closes[i] ?? 0;
                return {
                  date:   `${year}${month}${day}`,
                  open:   opens[i]   ?? close,
                  high:   highs[i]   ?? close,
                  low:    lows[i]    ?? close,
                  close,
                  volume: volumes[i] ?? 0,
                };
              })
              .filter(c => c.close > 0)
              .slice(-count);

            res.end(JSON.stringify(candles));
            return;
          }

          // ── GET /api/us-stock/:symbol/current ────────────────────────────
          // Latest price for a single symbol
          const currentMatch = url.match(/^\/api\/us-stock\/([^/?]+)\/current/);
          if (currentMatch) {
            const symbol   = decodeURIComponent(currentMatch[1]).toUpperCase();
            const yahooUrl = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbol}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,preMarketPrice,postMarketPrice,marketState`;
            const buf  = await yahooGet(yahooUrl);
            const data = JSON.parse(buf.toString('utf-8'));
            const q    = data?.quoteResponse?.result?.[0];
            if (!q) { sendErr(404, `No quote for ${symbol}`); return; }

            const price = (q.regularMarketPrice as number)
              ?? (q.postMarketPrice as number)
              ?? (q.preMarketPrice as number)
              ?? 0;
            res.end(JSON.stringify({
              symbol,
              price,
              change:        q.regularMarketChange        ?? 0,
              changePercent: q.regularMarketChangePercent ?? 0,
              preMarket:     q.preMarketPrice             ?? null,
              postMarket:    q.postMarketPrice            ?? null,
              marketState:   q.marketState                ?? 'UNKNOWN',
            }));
            return;
          }

          sendErr(404, `Unknown US-stock route: ${url}`);
        } catch (e) {
          console.error('[us-stock-api]', e);
          sendErr(500, String(e));
        }
      });
    },
  };
}

/** Vite dev-server middleware that proxies Naver Finance APIs */
function naverStockPlugin(): Plugin {
  return {
    name: 'naver-stock-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';

        // ── GET /api/market/indices — KOSPI, KOSDAQ, USD/KRW ─────────
        if (url === '/api/market/indices') {
          try {
            const fetchIndex = async (sym: string) => {
              const buf = await naverGet(`https://m.stock.naver.com/api/index/${sym}/basic`);
              const d = JSON.parse(buf.toString('utf-8'));
              return {
                name: d.indexName ?? sym,
                price: parseFloat((d.closePrice ?? '0').replace(/,/g, '')),
                change: parseFloat((d.compareToPreviousClosePrice ?? '0').replace(/,/g, '')),
                changeRate: parseFloat(d.fluctuationsRatio ?? '0'),
                direction: d.compareToPreviousPrice?.code ?? '3',
                marketStatus: d.marketStatus ?? 'UNKNOWN',
              };
            };
            const fetchFx = async () => {
              const buf = await naverGet('https://m.stock.naver.com/api/index/FX_USDKRW/basic');
              const d = JSON.parse(buf.toString('utf-8'));
              return {
                name: 'USD/KRW',
                price: parseFloat((d.closePrice ?? '0').replace(/,/g, '')),
                change: parseFloat((d.compareToPreviousClosePrice ?? '0').replace(/,/g, '')),
                changeRate: parseFloat(d.fluctuationsRatio ?? '0'),
                direction: d.compareToPreviousPrice?.code ?? '3',
              };
            };
            const [kospi, kosdaq, usdkrw] = await Promise.all([
              fetchIndex('KOSPI'), fetchIndex('KOSDAQ'), fetchFx(),
            ]);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ kospi, kosdaq, usdkrw, ts: Date.now() }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // ── GET /api/stock/:code/current ──────────────────────────────
        const curMatch = url.match(/^\/api\/stock\/([^/?]+)\/current/);
        if (curMatch) {
          const code = decodeURIComponent(curMatch[1]);
          try {
            const buf = await naverGet(
              `https://m.stock.naver.com/api/stock/${code}/basic`,
            );
            const json = JSON.parse(buf.toString('utf-8'));
            const price = parseInt(
              (json.closePrice ?? '0').replace(/,/g, ''),
              10,
            );
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                code,
                name: json.stockName ?? code,
                price,
                change: parseInt(
                  (json.compareToPreviousClosePrice ?? '0').replace(/,/g, ''),
                  10,
                ),
                changeRate: parseFloat(json.fluctuationsRatio ?? '0'),
                direction: json.compareToPreviousPrice?.code ?? '3',
                marketStatus: json.marketStatus ?? 'UNKNOWN',
              }),
            );
          } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        // ── GET /api/stock/:code/candles?count=N&timeframe=day|week|month|minute ─
        const candleMatch = url.match(/^\/api\/stock\/([^/?]+)\/candles/);
        if (candleMatch) {
          const code = decodeURIComponent(candleMatch[1]);
          const qp = new URLSearchParams(url.split('?')[1] ?? '');
          const count = Number(qp.get('count') ?? '100');
          const timeframe = qp.get('timeframe') ?? 'day'; // day | week | month | minute
          try {
            const buf = await naverGet(
              `https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=${timeframe}&count=${count}&requestType=0`,
            );
            // fchart may be EUC-KR — data attributes are ASCII, latin1 is safe
            const text = buf.toString('latin1');
            const matches = [...text.matchAll(/data="([^"]+)"/g)];
            const pv = (s: string, fallback = 0) => { const v = parseInt(s); return isNaN(v) ? fallback : v; };
            const candles = matches
              .map((m) => {
                const parts = m[1].split('|');
                if (parts.length < 6) return null;
                const [date, rawOpen, rawHigh, rawLow, rawClose, rawVol] = parts;
                const close = pv(rawClose);
                return {
                  date,
                  open:   pv(rawOpen,  close),  // 분봉은 null → close로 대체
                  high:   pv(rawHigh,  close),
                  low:    pv(rawLow,   close),
                  close,
                  volume: pv(rawVol),
                };
              })
              .filter(
                (c): c is NonNullable<typeof c> => c !== null && c.close > 0,
              );
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(candles));
          } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }

        next();
      });
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// KIS Open Trading API Proxy Plugin
// Routes /api/kis/* → KIS REST API server-side (CORS-free, credentials stay local)
// Ref: https://github.com/koreainvestment/open-trading-api
// ─────────────────────────────────────────────────────────────────────────────

function readBody(req: any): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString()));
    req.on('end', () => resolve(body));
  });
}

function kisHttpRequest(
  method: string,
  hostname: string,
  port: number,
  reqPath: string,
  headers: Record<string, string | number>,
  body?: string,
): Promise<{ statusCode: number; data: string }> {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname,
      port,
      path: reqPath,
      method,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        charset: 'UTF-8',
        ...headers,
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
      rejectUnauthorized: false,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c: Buffer) => (data += c.toString('utf-8')));
      res.on('end', () => resolve({ statusCode: res.statusCode ?? 500, data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Toss Securities Open API Proxy Plugin
// Routes /api/toss/* → https://openapi.tossinvest.com (single prod server)
// Ref: https://openapi.tossinvest.com
// ─────────────────────────────────────────────────────────────────────────────

function tossHttpRequest(
  method: string,
  reqPath: string,
  headers: Record<string, string | number>,
  body?: string,
): Promise<{ statusCode: number; data: string }> {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'openapi.tossinvest.com',
      port: 443,
      path: reqPath,
      method,
      headers: {
        ...headers,
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
      rejectUnauthorized: true,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c: Buffer) => (data += c.toString('utf-8')));
      res.on('end', () => resolve({ statusCode: res.statusCode ?? 500, data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function tossApiPlugin(): Plugin {
  return {
    name: 'toss-api-proxy',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/toss')) { next(); return; }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const sendError = (code: number, msg: string) => {
          res.statusCode = code;
          res.end(JSON.stringify({ error: msg }));
        };

        const token    = (req.headers['x-toss-token']       as string) ?? '';
        const accSeq   = (req.headers['x-toss-account-seq'] as string) ?? '';

        const authHdr: Record<string, string> = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        };
        const accountHdr: Record<string, string> = {
          ...authHdr,
          ...(accSeq ? { 'X-Tossinvest-Account': accSeq } : {}),
        };

        try {
          // ── POST /api/toss/token ────────────────────────────────────────
          if (url === '/api/toss/token' && req.method === 'POST') {
            const raw = await readBody(req);
            const { clientId, clientSecret } = JSON.parse(raw);
            const formBody = `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;
            const result = await tossHttpRequest('POST', '/oauth2/token', {
              'Content-Type': 'application/x-www-form-urlencoded',
            }, formBody);
            res.statusCode = result.statusCode;
            res.end(result.data);
            return;
          }

          // ── GET /api/toss/accounts ──────────────────────────────────────
          if (url === '/api/toss/accounts' && req.method === 'GET') {
            const result = await tossHttpRequest('GET', '/api/v1/accounts', authHdr);
            res.statusCode = result.statusCode;
            res.end(result.data);
            return;
          }

          // ── GET /api/toss/prices?symbols=005930 ────────────────────────
          if (url.startsWith('/api/toss/prices') && req.method === 'GET') {
            const p = new URLSearchParams(url.split('?')[1] ?? '');
            const result = await tossHttpRequest('GET', `/api/v1/prices?symbols=${p.get('symbols') ?? '005930'}`, authHdr);
            res.statusCode = result.statusCode;
            res.end(result.data);
            return;
          }

          // ── GET /api/toss/holdings ──────────────────────────────────────
          if (url.startsWith('/api/toss/holdings') && req.method === 'GET') {
            const p = new URLSearchParams(url.split('?')[1] ?? '');
            const sym = p.get('symbol');
            const result = await tossHttpRequest('GET', `/api/v1/holdings${sym ? `?symbol=${sym}` : ''}`, accountHdr);
            res.statusCode = result.statusCode;
            res.end(result.data);
            return;
          }

          // ── GET /api/toss/buying-power?currency=KRW ────────────────────
          if (url.startsWith('/api/toss/buying-power') && req.method === 'GET') {
            const p = new URLSearchParams(url.split('?')[1] ?? '');
            const result = await tossHttpRequest('GET', `/api/v1/buying-power?currency=${p.get('currency') ?? 'KRW'}`, accountHdr);
            res.statusCode = result.statusCode;
            res.end(result.data);
            return;
          }

          // ── POST /api/toss/order ────────────────────────────────────────
          if (url === '/api/toss/order' && req.method === 'POST') {
            const raw = await readBody(req);
            const result = await tossHttpRequest('POST', '/api/v1/orders', accountHdr, raw);
            res.statusCode = result.statusCode;
            res.end(result.data);
            return;
          }

          // ── POST /api/toss/order/cancel — body: { orderId } ────────────
          if (url === '/api/toss/order/cancel' && req.method === 'POST') {
            const raw = await readBody(req);
            const { orderId } = JSON.parse(raw);
            const result = await tossHttpRequest('POST', `/api/v1/orders/${encodeURIComponent(orderId)}/cancel`, accountHdr, '{}');
            res.statusCode = result.statusCode;
            res.end(result.data);
            return;
          }

          // ── POST /api/toss/order/modify — body: { orderId, ...fields } ─
          if (url === '/api/toss/order/modify' && req.method === 'POST') {
            const raw = await readBody(req);
            const { orderId, ...modBody } = JSON.parse(raw);
            const result = await tossHttpRequest('POST', `/api/v1/orders/${encodeURIComponent(orderId)}/modify`, accountHdr, JSON.stringify(modBody));
            res.statusCode = result.statusCode;
            res.end(result.data);
            return;
          }

          // ── GET /api/toss/orders?status=OPEN&limit=20 ──────────────────
          if (url.startsWith('/api/toss/orders') && req.method === 'GET') {
            const p = new URLSearchParams(url.split('?')[1] ?? '');
            const qp = new URLSearchParams({ status: p.get('status') ?? 'OPEN' });
            if (p.get('symbol')) qp.set('symbol', p.get('symbol')!);
            if (p.get('from'))   qp.set('from', p.get('from')!);
            if (p.get('to'))     qp.set('to', p.get('to')!);
            if (p.get('cursor')) qp.set('cursor', p.get('cursor')!);
            if (p.get('limit'))  qp.set('limit', p.get('limit')!);
            const result = await tossHttpRequest('GET', `/api/v1/orders?${qp}`, accountHdr);
            res.statusCode = result.statusCode;
            res.end(result.data);
            return;
          }

          // ── GET /api/toss/candles?symbol=&interval=1d&count=100 ────────
          if (url.startsWith('/api/toss/candles') && req.method === 'GET') {
            const p = new URLSearchParams(url.split('?')[1] ?? '');
            const qp = new URLSearchParams({
              symbol: p.get('symbol') ?? '005930',
              interval: p.get('interval') ?? '1d',
              count: p.get('count') ?? '100',
            });
            const result = await tossHttpRequest('GET', `/api/v1/candles?${qp}`, authHdr);
            res.statusCode = result.statusCode;
            res.end(result.data);
            return;
          }

          sendError(404, `Unknown Toss route: ${url}`);
        } catch (e) {
          console.error('[toss-api-proxy]', e);
          sendError(500, String(e));
        }
      });
    },
  };
}

function kisApiPlugin(): Plugin {
  return {
    name: 'kis-api-proxy',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/kis')) { next(); return; }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const sendError = (code: number, msg: string) => {
          res.statusCode = code;
          res.end(JSON.stringify({ error: msg }));
        };

        const isReal = (req.headers['x-kis-server'] as string) === 'real';
        const hostname = isReal
          ? 'openapi.koreainvestment.com'
          : 'openapivts.koreainvestment.com';
        const port = isReal ? 9443 : 29443;

        const token     = (req.headers['x-kis-token']    as string) ?? '';
        const appKey    = (req.headers['x-kis-appkey']   as string) ?? '';
        const appSecret = (req.headers['x-kis-appsecret'] as string) ?? '';

        const authHdr = {
          Authorization: `Bearer ${token}`,
          appkey: appKey,
          appsecret: appSecret,
          custtype: 'P',
        };

        try {
          // ── POST /api/kis/token ─────────────────────────────────────
          if (url === '/api/kis/token' && req.method === 'POST') {
            const raw = await readBody(req);
            const { appKey: ak, appSecret: as_ } = JSON.parse(raw);
            const result = await kisHttpRequest('POST', hostname, port,
              '/oauth2/tokenP', {},
              JSON.stringify({ grant_type: 'client_credentials', appkey: ak, appsecret: as_ }),
            );
            res.statusCode = result.statusCode;
            res.end(result.data);
            return;
          }

          // ── GET /api/kis/price?code=005930 ──────────────────────────
          if (url.startsWith('/api/kis/price') && req.method === 'GET') {
            const code = new URLSearchParams(url.split('?')[1] ?? '').get('code') ?? '005930';
            const result = await kisHttpRequest('GET', hostname, port,
              `/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${code}`,
              { ...authHdr, tr_id: 'FHKST01010100' },
            );
            res.statusCode = result.statusCode;
            res.end(result.data);
            return;
          }

          // ── GET /api/kis/balance?cano=XXXXXXXX&acntPrdtCd=01 ───────
          if (url.startsWith('/api/kis/balance') && req.method === 'GET') {
            const p = new URLSearchParams(url.split('?')[1] ?? '');
            const trId = isReal ? 'TTTC8434R' : 'VTTC8434R';
            const qp = new URLSearchParams({
              CANO: p.get('cano') ?? '',
              ACNT_PRDT_CD: p.get('acntPrdtCd') ?? '01',
              AFHR_FLPR_YN: 'N', OFL_YN: '', INQR_DVSN: '02',
              UNPR_DVSN: '01', FUND_STTL_ICLD_YN: 'N',
              FNCG_AMT_AUTO_RDPT_YN: 'N', PRCS_DVSN: '00',
              CTX_AREA_FK100: '', CTX_AREA_NK100: '',
            });
            const result = await kisHttpRequest('GET', hostname, port,
              `/uapi/domestic-stock/v1/trading/inquire-balance?${qp}`,
              { ...authHdr, tr_id: trId },
            );
            res.statusCode = result.statusCode;
            res.end(result.data);
            return;
          }

          // ── POST /api/kis/order (buy / sell) ────────────────────────
          if (url === '/api/kis/order' && req.method === 'POST') {
            const raw = await readBody(req);
            const { cano, acntPrdtCd, pdno, ordDvsn, ordQty, ordUnpr, side } = JSON.parse(raw);
            const trId = isReal
              ? (side === 'buy' ? 'TTTC0012U' : 'TTTC0011U')
              : (side === 'buy' ? 'VTTC0012U' : 'VTTC0011U');
            const result = await kisHttpRequest('POST', hostname, port,
              '/uapi/domestic-stock/v1/trading/order-cash',
              { ...authHdr, tr_id: trId },
              JSON.stringify({
                CANO: cano, ACNT_PRDT_CD: acntPrdtCd,
                PDNO: pdno, ORD_DVSN: ordDvsn,
                ORD_QTY: String(ordQty), ORD_UNPR: String(ordUnpr ?? 0),
                EXCG_ID_DVSN_CD: 'KRX',
              }),
            );
            res.statusCode = result.statusCode;
            res.end(result.data);
            return;
          }

          // ── DELETE /api/kis/order (cancel) ──────────────────────────
          if (url === '/api/kis/order' && req.method === 'DELETE') {
            const raw = await readBody(req);
            const { cano, acntPrdtCd, orgOdno, orgBrno, ordDvsn, ordQty } = JSON.parse(raw);
            const trId = isReal ? 'TTTC0013U' : 'VTTC0013U';
            const result = await kisHttpRequest('POST', hostname, port,
              '/uapi/domestic-stock/v1/trading/order-rvsecncl',
              { ...authHdr, tr_id: trId },
              JSON.stringify({
                CANO: cano, ACNT_PRDT_CD: acntPrdtCd,
                KRX_FWDG_ORD_ORGNO: orgBrno ?? '',
                ORGN_ODNO: orgOdno, ORD_DVSN: ordDvsn ?? '00',
                RVSE_CNCL_DVSN_CD: '02',
                ORD_QTY: String(ordQty), QTY_ALL_ORD_YN: 'Y',
                ORD_UNPR: '0', EXCG_ID_DVSN_CD: 'KRX',
              }),
            );
            res.statusCode = result.statusCode;
            res.end(result.data);
            return;
          }

          // ── GET /api/kis/orders — 일별 체결 내역 ───────────────────
          if (url.startsWith('/api/kis/orders') && req.method === 'GET') {
            const p = new URLSearchParams(url.split('?')[1] ?? '');
            const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const trId = isReal ? 'TTTC0081R' : 'VTTC0081R';
            const qp = new URLSearchParams({
              CANO: p.get('cano') ?? '', ACNT_PRDT_CD: p.get('acntPrdtCd') ?? '01',
              INQR_STRT_DT: p.get('startDt') ?? today,
              INQR_END_DT: p.get('endDt') ?? today,
              SLL_BUY_DVSN_CD: '00', INQR_DVSN: '00', PDNO: '',
              CCLD_DVSN: '00', ORD_GNO_BRNO: '', ODNO: '',
              INQR_DVSN_3: '00', INQR_DVSN_1: '',
              CTX_AREA_FK100: '', CTX_AREA_NK100: '',
            });
            const result = await kisHttpRequest('GET', hostname, port,
              `/uapi/domestic-stock/v1/trading/inquire-daily-ccld?${qp}`,
              { ...authHdr, tr_id: trId },
            );
            res.statusCode = result.statusCode;
            res.end(result.data);
            return;
          }

          // ── GET /api/kis/pending — 미체결 잔량 ─────────────────────
          if (url.startsWith('/api/kis/pending') && req.method === 'GET') {
            const p = new URLSearchParams(url.split('?')[1] ?? '');
            const trId = 'TTTC0084R'; // 모의/실전 동일 TR ID
            const qp = new URLSearchParams({
              CANO: p.get('cano') ?? '', ACNT_PRDT_CD: p.get('acntPrdtCd') ?? '01',
              INQR_DVSN_1: '', INQR_DVSN_2: '00',
              CTX_AREA_FK100: '', CTX_AREA_NK100: '',
            });
            const result = await kisHttpRequest('GET', hostname, port,
              `/uapi/domestic-stock/v1/trading/inquire-psbl-rvsecncl?${qp}`,
              { ...authHdr, tr_id: trId },
            );
            res.statusCode = result.statusCode;
            res.end(result.data);
            return;
          }

          sendError(404, `Unknown KIS route: ${url}`);
        } catch (e) {
          console.error('[kis-api-proxy]', e);
          sendError(500, String(e));
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), naverStockPlugin(), usStockPlugin(), tossApiPlugin(), kisApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
