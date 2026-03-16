/**
 * 日経スマートチャート スクレイピング (JP株)
 * https://www.nikkei.com/async/async.do/ の非公開APIを利用
 *
 * 日足 OHLC: JO_MM_CHART_CANDLE_STICK → [timestamp_ms, open, high, low, close]
 * 分足 Line: JO_MM_CHART_ONE          → [timestamp_ms, price, null, null]
 */

const BASE_URL = "https://www.nikkei.com";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 60_000; // 1分

export interface NikkeiCandle {
  date: string;   // daily: "YYYY-MM-DD", intraday: Unix seconds (number as string won't work, use number)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** lightweight-charts 用: daily = "YYYY-MM-DD", intraday = Unix seconds */
export interface NikkeiCandleLC {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NikkeiQuote {
  price: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: number;
  name: string;
}

const NIKKEI_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/javascript, */*; q=0.01",
  "X-Requested-With": "XMLHttpRequest",
};

// ==================== 日足 (Daily) ====================

function toChartType(days: number): string {
  if (days <= 90) return "candlestick_daily_3m";
  if (days <= 180) return "candlestick_daily_6m";
  if (days <= 365) return "candlestick_daily_1y";
  if (days <= 730) return "candlestick_daily_2y";
  return "candlestick_daily_5y";
}

export async function getCandles(code: string, days: number = 90): Promise<NikkeiCandleLC[]> {
  const scode = code.length === 5 ? code.slice(0, 4) : code;
  const chartType = toChartType(days);
  const cacheKey = `candle:${scode}:${chartType}`;

  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const url = `${BASE_URL}/async/async.do/?ae=JO_MM_CHART_CANDLE_STICK&chartType=${chartType}&ohlcFlg=2&scode=${scode}&sv=NX`;
  const res = await fetch(url, {
    headers: { ...NIKKEI_HEADERS, Referer: `${BASE_URL}/nkd/company/chart/?scode=${scode}` },
  });

  if (!res.ok) throw new Error(`Nikkei API error: ${res.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json();

  if (json.CODE !== 0 || !json.RESULT?.data_lists?.[0]) {
    console.warn(`[Nikkei] No data for ${scode}, CODE=${json.CODE}`);
    return [];
  }

  const dataList = json.RESULT.data_lists[0];
  const chartData = Array.isArray(dataList.data) ? dataList.data[0] : dataList.data;
  const ohlcData: number[][] = chartData?.ohlc || [];
  const volumeData: number[][] = chartData?.volume || [];

  const volumeMap = new Map<number, number>();
  for (const [ts, vol] of volumeData) volumeMap.set(ts, vol);

  const candles: NikkeiCandleLC[] = ohlcData
    .filter(([, open, , , close]) => open > 0 && close > 0)
    .map(([ts, open, high, low, close]) => {
      const jstMs = ts + 9 * 60 * 60 * 1000;
      const d = new Date(jstMs);
      const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      return { time: date, open, high, low, close, volume: volumeMap.get(ts) || 0 };
    });

  cache.set(cacheKey, { data: candles, expires: Date.now() + CACHE_TTL });
  return candles;
}

// ==================== 分足 (Intraday) ====================

/**
 * 日経1分足データを取得し、指定間隔のOHLCキャンドルに集約
 * @param intervalMin 1, 5, 10, 15, 30, 60, 120, 180, 240
 */
export async function getIntradayCandles(
  code: string,
  intervalMin: number = 5
): Promise<NikkeiCandleLC[]> {
  const scode = code.length === 5 ? code.slice(0, 4) : code;
  const cacheKey = `intraday:${scode}:${intervalMin}`;

  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  // one_m = 2日分の1分足, one_l = 2日分(同じ)
  const url = `${BASE_URL}/async/async.do/?ae=JO_MM_CHART_ONE&chartType=one_m&scode=${scode}&sv=NX`;
  const res = await fetch(url, {
    headers: { ...NIKKEI_HEADERS, Referer: `${BASE_URL}/nkd/company/chart/?scode=${scode}` },
  });

  if (!res.ok) throw new Error(`Nikkei intraday API error: ${res.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json();

  if (json.CODE !== 0 || !json.RESULT?.data_lists?.[0]) {
    console.warn(`[Nikkei intraday] No data for ${scode}, CODE=${json.CODE}`);
    return [];
  }

  const dataList = json.RESULT.data_lists[0];
  // data は [timestamp_ms, price, null, null][] の配列
  const rawData: (number | null)[][] = dataList.data || [];

  // null価格を除去
  const ticks = rawData
    .filter((d) => d[1] != null && d[1] > 0)
    .map((d) => ({ ts: d[0] as number, price: d[1] as number }));

  if (ticks.length === 0) return [];

  // intervalMin 分ごとにOHLCを集約
  const intervalMs = intervalMin * 60 * 1000;
  const candles: NikkeiCandleLC[] = [];
  let bucketStart = Math.floor(ticks[0].ts / intervalMs) * intervalMs;
  let open = ticks[0].price;
  let high = ticks[0].price;
  let low = ticks[0].price;
  let close = ticks[0].price;

  for (const tick of ticks) {
    const bucket = Math.floor(tick.ts / intervalMs) * intervalMs;
    if (bucket !== bucketStart) {
      // lightweight-charts の time は UTC seconds
      candles.push({ time: Math.floor(bucketStart / 1000), open, high, low, close, volume: 0 });
      bucketStart = bucket;
      open = tick.price;
      high = tick.price;
      low = tick.price;
    }
    if (tick.price > high) high = tick.price;
    if (tick.price < low) low = tick.price;
    close = tick.price;
  }
  // Last bucket
  candles.push({ time: Math.floor(bucketStart / 1000), open, high, low, close, volume: 0 });

  cache.set(cacheKey, { data: candles, expires: Date.now() + CACHE_TTL });
  return candles;
}

// ==================== 株価 (Quote) ====================

export async function getQuote(code: string): Promise<NikkeiQuote> {
  const candles = await getCandles(code, 90);
  if (candles.length === 0) throw new Error(`No Nikkei data for ${code}`);

  const latest = candles[candles.length - 1];
  const prev = candles.length > 1 ? candles[candles.length - 2] : null;
  const prevClose = prev ? prev.close : latest.open;

  let name = "";
  try { name = await getStockName(code); } catch { /* ignore */ }

  return {
    price: latest.close,
    open: latest.open,
    high: latest.high,
    low: latest.low,
    previousClose: prevClose,
    change: latest.close - prevClose,
    changePercent: ((latest.close - prevClose) / prevClose) * 100,
    volume: latest.volume,
    timestamp: typeof latest.time === "string" ? new Date(latest.time).getTime() : latest.time * 1000,
    name,
  };
}

// ==================== 銘柄名 ====================

const nameCache = new Map<string, { name: string; expires: number }>();
const NAME_CACHE_TTL = 24 * 60 * 60 * 1000;

async function getStockName(code: string): Promise<string> {
  const scode = code.length === 5 ? code.slice(0, 4) : code;
  const cached = nameCache.get(scode);
  if (cached && cached.expires > Date.now()) return cached.name;

  const url = `${BASE_URL}/smartchart/?code=${scode}`;
  const res = await fetch(url, {
    headers: { "User-Agent": NIKKEI_HEADERS["User-Agent"] },
  });
  if (!res.ok) return "";

  const html = await res.text();
  const match = html.match(/stock_info_name["']?\s*:\s*["']([^"']+)["']/);
  const name = match ? match[1] : "";

  nameCache.set(scode, { name, expires: Date.now() + NAME_CACHE_TTL });
  return name;
}
