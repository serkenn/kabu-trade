/**
 * J-Quants API v2 クライアント (日本株)
 * 認証: x-api-key ヘッダー
 * @see https://jpx-jquants.com/ja/spec/quickstart
 */

const BASE_URL = "https://api.jquants.com/v2";

function getApiKey(): string {
  const key = process.env.JQUANTS_API_KEY;
  if (!key) throw new Error("JQUANTS_API_KEY is not set");
  return key;
}

// 4桁コード → 5桁コード変換 (J-Quants v2は5桁)
function toCode5(code: string): string {
  return code.length === 4 ? code + "0" : code;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 30_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function jquantsFetch(path: string): Promise<any> {
  const cacheKey = path;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const url = `${BASE_URL}${path}`;
  console.log(`[J-Quants] Fetching: ${url}`);

  const res = await fetch(url, {
    headers: { "x-api-key": getApiKey() },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[J-Quants] Error ${res.status}: ${text}`);
    throw new Error(`J-Quants API error: ${res.status} ${text}`);
  }

  const data = await res.json();
  cache.set(cacheKey, { data, expires: Date.now() + CACHE_TTL });
  return data;
}

export interface JQuantsQuote {
  Code: string;
  Date: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
  AdjustmentClose: number;
}

export interface JQuantsListedInfo {
  Code: string;
  CompanyName: string;
  CompanyNameEnglish: string;
  Sector17Code: string;
  Sector17CodeName: string;
  Sector33Code: string;
  Sector33CodeName: string;
  MarketCode: string;
  MarketCodeName: string;
}

export async function getListedInfo(code?: string) {
  const path = code
    ? `/equities/list?code=${toCode5(code)}`
    : "/equities/list";
  const data = await jquantsFetch(path);
  return (data.list || data.info || []) as JQuantsListedInfo[];
}

export async function getDailyQuotes(code: string, from?: string, to?: string) {
  let path = `/equities/bars/daily?code=${toCode5(code)}`;
  if (from) path += `&from=${from}`;
  if (to) path += `&to=${to}`;
  const data = await jquantsFetch(path);
  return (data.bars || data.daily_quotes || []) as JQuantsQuote[];
}

export async function getTradingCalendar(from?: string, to?: string) {
  let path = "/markets/trading_calendar";
  const params = [];
  if (from) params.push(`from=${from}`);
  if (to) params.push(`to=${to}`);
  if (params.length) path += `?${params.join("&")}`;
  const data = await jquantsFetch(path);
  return data.trading_calendar;
}
