/**
 * 日経スマートチャート スクレイピング (JP株)
 * https://www.nikkei.com/async/async.do/ の非公開APIを利用
 *
 * OHLC: [timestamp_ms, open, high, low, close]
 * Volume: [timestamp_ms, volume]
 */

const BASE_URL = "https://www.nikkei.com";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 60_000; // 1分

export interface NikkeiCandle {
  date: string;   // "YYYY-MM-DD"
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

/**
 * days → 日経チャートタイプ
 */
function toChartType(days: number): string {
  if (days <= 90) return "candlestick_daily_3m";
  if (days <= 180) return "candlestick_daily_6m";
  if (days <= 365) return "candlestick_daily_1y";
  if (days <= 730) return "candlestick_daily_2y";
  return "candlestick_daily_5y";
}

/**
 * 日経チャートデータAPIから OHLCV データを取得
 */
export async function getCandles(code: string, days: number = 90): Promise<NikkeiCandle[]> {
  // 4桁コードのみ使用（5桁の場合は末尾除去）
  const scode = code.length === 5 ? code.slice(0, 4) : code;
  const chartType = toChartType(days);
  const cacheKey = `candle:${scode}:${chartType}`;

  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const url = `${BASE_URL}/async/async.do/?ae=JO_MM_CHART_CANDLE_STICK&chartType=${chartType}&ohlcFlg=2&scode=${scode}&sv=NX`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": `${BASE_URL}/nkd/company/chart/?scode=${scode}`,
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  if (!res.ok) {
    throw new Error(`Nikkei API error: ${res.status}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json();

  if (json.CODE !== 0 || !json.RESULT?.data_lists?.[0]) {
    console.warn(`[Nikkei] No data for ${scode}, CODE=${json.CODE}`);
    return [];
  }

  const dataList = json.RESULT.data_lists[0];
  // data は配列: [{volume: [[ts,vol],...], ohlc: [[ts,o,h,l,c],...]}]
  const chartData = Array.isArray(dataList.data) ? dataList.data[0] : dataList.data;
  const ohlcData: number[][] = chartData?.ohlc || [];
  const volumeData: number[][] = chartData?.volume || [];

  // Volume をマップ化 (timestamp → volume)
  const volumeMap = new Map<number, number>();
  for (const [ts, vol] of volumeData) {
    volumeMap.set(ts, vol);
  }

  const candles: NikkeiCandle[] = ohlcData
    .filter(([, open, , , close]) => open > 0 && close > 0)
    .map(([ts, open, high, low, close]) => {
      // 日経タイムスタンプはJST午前0時 = UTC 15:00前日
      // JST (UTC+9) で日付を計算
      const jstMs = ts + 9 * 60 * 60 * 1000;
      const d = new Date(jstMs);
      const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      return {
        date,
        open,
        high,
        low,
        close,
        volume: volumeMap.get(ts) || 0,
      };
    });

  cache.set(cacheKey, { data: candles, expires: Date.now() + CACHE_TTL });
  return candles;
}

/**
 * 最新株価を取得 (キャンドルデータの最新エントリから)
 */
export async function getQuote(code: string): Promise<NikkeiQuote> {
  const candles = await getCandles(code, 90);
  if (candles.length === 0) {
    throw new Error(`No Nikkei data for ${code}`);
  }

  const latest = candles[candles.length - 1];
  const prev = candles.length > 1 ? candles[candles.length - 2] : null;
  const prevClose = prev ? prev.close : latest.open;

  // 銘柄名を取得（スマートチャートの初期データから）
  let name = "";
  try {
    name = await getStockName(code);
  } catch {
    // ignore
  }

  return {
    price: latest.close,
    open: latest.open,
    high: latest.high,
    low: latest.low,
    previousClose: prevClose,
    change: latest.close - prevClose,
    changePercent: ((latest.close - prevClose) / prevClose) * 100,
    volume: latest.volume,
    timestamp: new Date(latest.date).getTime(),
    name,
  };
}

/**
 * スマートチャートページから銘柄名を取得
 */
const nameCache = new Map<string, { name: string; expires: number }>();
const NAME_CACHE_TTL = 24 * 60 * 60 * 1000; // 24時間

async function getStockName(code: string): Promise<string> {
  const scode = code.length === 5 ? code.slice(0, 4) : code;
  const cached = nameCache.get(scode);
  if (cached && cached.expires > Date.now()) {
    return cached.name;
  }

  const url = `${BASE_URL}/smartchart/?code=${scode}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) return "";

  const html = await res.text();
  const match = html.match(/stock_info_name["']?\s*:\s*["']([^"']+)["']/);
  const name = match ? match[1] : "";

  nameCache.set(scode, { name, expires: Date.now() + NAME_CACHE_TTL });
  return name;
}
