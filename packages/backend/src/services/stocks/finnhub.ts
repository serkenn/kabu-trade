/**
 * Finnhub API クライアント (米国株)
 */

const BASE_URL = "https://finnhub.io/api/v1";

function getApiKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY is not set");
  return key;
}

const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 10_000; // 10秒

async function finnhubFetch(path: string) {
  const cacheKey = path;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const res = await fetch(`${BASE_URL}${path}&token=${getApiKey()}`);

  if (!res.ok) {
    throw new Error(`Finnhub API error: ${res.status}`);
  }

  const data = await res.json();
  cache.set(cacheKey, { data, expires: Date.now() + CACHE_TTL });
  return data;
}

export interface FinnhubQuote {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

export interface FinnhubCandle {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  v: number[];
  t: number[];
  s: string;
}

export interface FinnhubSymbol {
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
}

export async function getQuote(symbol: string): Promise<FinnhubQuote> {
  return finnhubFetch(`/quote?symbol=${symbol}`) as Promise<FinnhubQuote>;
}

export async function getCandles(
  symbol: string,
  resolution: string,
  from: number,
  to: number
): Promise<FinnhubCandle> {
  return finnhubFetch(
    `/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}`
  ) as Promise<FinnhubCandle>;
}

export async function searchSymbol(query: string): Promise<FinnhubSymbol[]> {
  const data = await finnhubFetch(`/search?q=${encodeURIComponent(query)}`) as { result?: FinnhubSymbol[] };
  return data.result || [];
}

export async function getCompanyProfile(symbol: string) {
  return finnhubFetch(`/stock/profile2?symbol=${symbol}`);
}
