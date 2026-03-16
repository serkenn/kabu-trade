/**
 * Stooq データプロバイダー (JP株 + US株のヒストリカルデータ)
 * 無料で利用可能。認証不要。
 * JP株: {code}.jp  (例: 7203.jp)
 * US株: {symbol}.us (例: AAPL.US)
 */

const BASE_URL = "https://stooq.com/q/d/l/";

const cache = new Map<string, { data: StooqCandle[]; expires: number }>();
const CACHE_TTL = 60_000; // 1分

export interface StooqCandle {
  date: string;   // "YYYY-MM-DD"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function toStooqSymbol(code: string, market: "JP" | "US"): string {
  if (market === "JP") {
    // 4桁 or 5桁 → 4桁.jp
    const c = code.replace(/\..*$/, "");
    return `${c.length === 5 ? c.slice(0, 4) : c}.jp`;
  }
  return `${code}.us`;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0].replace(/-/g, "");
}

export async function getCandles(
  code: string,
  market: "JP" | "US",
  days: number = 90
): Promise<StooqCandle[]> {
  const symbol = toStooqSymbol(code, market);
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);

  const d1 = formatDate(from);
  const d2 = formatDate(to);
  const cacheKey = `${symbol}:${d1}:${d2}`;

  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const url = `${BASE_URL}?s=${symbol}&d1=${d1}&d2=${d2}&i=d`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; KabuTrade/1.0)",
    },
  });

  if (!res.ok) {
    throw new Error(`Stooq error: ${res.status}`);
  }

  const text = await res.text();
  const lines = text.trim().split("\n");

  // Header: Date,Open,High,Low,Close,Volume
  if (lines.length < 2) {
    console.warn(`[Stooq] No data for ${symbol}`);
    return [];
  }

  const header = lines[0].toLowerCase();
  if (!header.includes("date") || !header.includes("close")) {
    console.warn(`[Stooq] Unexpected format for ${symbol}: ${lines[0]}`);
    return [];
  }

  const candles: StooqCandle[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length < 6) continue;

    const [date, open, high, low, close, volume] = parts;
    const o = parseFloat(open);
    const h = parseFloat(high);
    const l = parseFloat(low);
    const c = parseFloat(close);
    const v = parseInt(volume, 10);

    if (isNaN(o) || isNaN(c)) continue;

    candles.push({ date, open: o, high: h, low: l, close: c, volume: v || 0 });
  }

  // Stooq returns newest first, lightweight-charts needs oldest first
  candles.sort((a, b) => a.date.localeCompare(b.date));

  cache.set(cacheKey, { data: candles, expires: Date.now() + CACHE_TTL });
  return candles;
}

/**
 * 最新の株価を取得 (最新キャンドルデータから)
 */
export async function getLatestQuote(code: string, market: "JP" | "US") {
  // 直近30日のデータを取得
  const candles = await getCandles(code, market, 30);
  if (candles.length === 0) {
    throw new Error(`No data for ${code} from Stooq`);
  }

  const latest = candles[candles.length - 1];
  const prev = candles.length > 1 ? candles[candles.length - 2] : null;
  const prevClose = prev ? prev.close : latest.open;

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
  };
}
