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
const MASTER_CACHE_TTL = 24 * 60 * 60 * 1000; // 銘柄一覧は24時間キャッシュ

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function jquantsFetch(path: string, ttl = CACHE_TTL): Promise<any> {
  const cacheKey = path;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { "x-api-key": getApiKey() },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`J-Quants API error: ${res.status} ${text}`);
  }

  const data = await res.json();
  cache.set(cacheKey, { data, expires: Date.now() + ttl });
  return data;
}

// ==================== レスポンス型 ====================

/** /equities/master のレスポンスアイテム (Premium Plan / Standard API 両対応) */
export interface JQuantsMasterItem {
  Code: string;
  // Premium Plan fields
  CoName: string;
  CoNameEn: string;
  S17Nm: string;
  S33Nm: string;
  MktNm: string;
  // Standard API fields
  CompanyName: string;
  CompanyNameEnglish: string;
  Sector17CodeName: string;
  Sector33CodeName: string;
  MarketCodeName: string;
}

/** /equities/bars/daily のレスポンスアイテム (Premium Plan / Standard API 両対応) */
export interface JQuantsBarItem {
  Date: string;
  Code: string;
  // Premium Plan fields
  O: number;   // Open
  H: number;   // High
  L: number;   // Low
  C: number;   // Close
  Vo: number;  // Volume
  AdjO: number;
  AdjH: number;
  AdjL: number;
  AdjC: number;
  AdjVo: number;
  // Standard API fields
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
  AdjustmentOpen: number;
  AdjustmentHigh: number;
  AdjustmentLow: number;
  AdjustmentClose: number;
  AdjustmentVolume: number;
}

// ==================== 公開関数 ====================

// 旧インターフェース互換（stocks/index.ts が使う型）
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

export async function getListedInfo(code?: string): Promise<JQuantsListedInfo[]> {
  // Try Premium Plan endpoint first, fallback to standard API
  const premiumPath = code
    ? `/equities/master?code=${toCode5(code)}`
    : "/equities/master";
  const standardPath = code
    ? `/listed/info?code=${toCode5(code)}`
    : "/listed/info";
  const path = process.env.JQUANTS_PREMIUM === "true" ? premiumPath : standardPath;
  const res = await jquantsFetch(path, MASTER_CACHE_TTL);
  // Support both Premium Plan ("data") and standard API ("info") response keys
  const items: JQuantsMasterItem[] = res.data || res.info || [];
  // 旧インターフェースに変換
  return items.map((i) => ({
    Code: i.Code.length === 5 ? i.Code.slice(0, 4) : i.Code,
    CompanyName: i.CoName || i.CompanyName || "",
    CompanyNameEnglish: i.CoNameEn || i.CompanyNameEnglish || "",
    Sector17Code: "",
    Sector17CodeName: i.S17Nm || i.Sector17CodeName || "",
    Sector33Code: "",
    Sector33CodeName: i.S33Nm || i.Sector33CodeName || "",
    MarketCode: "",
    MarketCodeName: i.MktNm || i.MarketCodeName || "",
  }));
}

export async function getDailyQuotes(code: string, from?: string, to?: string): Promise<JQuantsQuote[]> {
  // Use Premium Plan or standard API endpoint
  const endpoint = process.env.JQUANTS_PREMIUM === "true"
    ? "/equities/bars/daily"
    : "/prices/daily_quotes";
  let path = `${endpoint}?code=${toCode5(code)}`;
  if (from) path += `&from=${from}`;
  if (to) path += `&to=${to}`;
  const res = await jquantsFetch(path);
  // Support both Premium Plan ("data") and standard API ("daily_quotes") response keys
  const items: JQuantsBarItem[] = res.data || res.daily_quotes || [];
  if (items.length === 0) {
    console.warn(`[J-Quants] No daily data for ${code}, keys: ${Object.keys(res).join(",")}`);
  }
  // 旧インターフェースに変換 (Premium Plan / Standard API 両対応)
  return items.map((i) => ({
    Code: i.Code,
    Date: i.Date,
    Open: i.AdjO ?? i.AdjustmentOpen ?? i.O ?? i.Open,
    High: i.AdjH ?? i.AdjustmentHigh ?? i.H ?? i.High,
    Low: i.AdjL ?? i.AdjustmentLow ?? i.L ?? i.Low,
    Close: i.AdjC ?? i.AdjustmentClose ?? i.C ?? i.Close,
    Volume: i.AdjVo ?? i.AdjustmentVolume ?? i.Vo ?? i.Volume,
    AdjustmentClose: i.AdjC ?? i.AdjustmentClose ?? i.C ?? i.Close,
  }));
}

export async function getTradingCalendar(from?: string, to?: string) {
  let path = "/markets/trading_calendar";
  const params = [];
  if (from) params.push(`from=${from}`);
  if (to) params.push(`to=${to}`);
  if (params.length) path += `?${params.join("&")}`;
  const data = await jquantsFetch(path);
  return data.trading_calendar || data.data || [];
}
