/**
 * J-Quants API クライアント (日本株)
 * 認証: リフレッシュトークン → IDトークン → Bearer
 */

const BASE_URL = "https://api.jquants.com/v2";

function getRefreshToken(): string {
  const key = process.env.JQUANTS_API_KEY;
  if (!key) throw new Error("JQUANTS_API_KEY is not set");
  return key;
}

// IDトークンのキャッシュ (有効期限24時間だが余裕を持って23時間)
let idToken: string | null = null;
let idTokenExpires = 0;

async function getIdToken(): Promise<string> {
  if (idToken && idTokenExpires > Date.now()) {
    return idToken;
  }

  const res = await fetch(
    `${BASE_URL}/token/auth_refresh?refreshtoken=${getRefreshToken()}`,
    { method: "POST" }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`J-Quants auth failed: ${res.status} ${text}`);
  }

  const data = await res.json() as { idToken: string };
  idToken = data.idToken;
  idTokenExpires = Date.now() + 23 * 60 * 60 * 1000; // 23時間
  return idToken;
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

  const token = await getIdToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    // トークン期限切れの場合はリトライ
    if (res.status === 401) {
      idToken = null;
      idTokenExpires = 0;
      const newToken = await getIdToken();
      const retry = await fetch(`${BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${newToken}` },
      });
      if (!retry.ok) throw new Error(`J-Quants API error: ${retry.status}`);
      const data = await retry.json();
      cache.set(cacheKey, { data, expires: Date.now() + CACHE_TTL });
      return data;
    }
    throw new Error(`J-Quants API error: ${res.status}`);
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
  const path = code ? `/listed/info?code=${code}` : "/listed/info";
  const data = await jquantsFetch(path);
  return data.info as JQuantsListedInfo[];
}

export async function getDailyQuotes(code: string, from?: string, to?: string) {
  let path = `/prices/daily_quotes?code=${code}`;
  if (from) path += `&from=${from}`;
  if (to) path += `&to=${to}`;
  const data = await jquantsFetch(path);
  return data.daily_quotes as JQuantsQuote[];
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
