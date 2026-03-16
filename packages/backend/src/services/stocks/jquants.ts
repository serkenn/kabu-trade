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

/** /equities/master のレスポンスアイテム */
export interface JQuantsMasterItem {
  Code: string;
  CoName: string;
  CoNameEn: string;
  S17Nm: string;
  S33Nm: string;
  MktNm: string;
}

/** /equities/bars/daily のレスポンスアイテム */
export interface JQuantsBarItem {
  Date: string;
  Code: string;
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
  const path = code
    ? `/equities/master?code=${toCode5(code)}`
    : "/equities/master";
  const res = await jquantsFetch(path, MASTER_CACHE_TTL);
  const items: JQuantsMasterItem[] = res.data || [];
  // 旧インターフェースに変換
  return items.map((i) => ({
    Code: i.Code.length === 5 ? i.Code.slice(0, 4) : i.Code,
    CompanyName: i.CoName,
    CompanyNameEnglish: i.CoNameEn || "",
    Sector17Code: "",
    Sector17CodeName: i.S17Nm || "",
    Sector33Code: "",
    Sector33CodeName: i.S33Nm || "",
    MarketCode: "",
    MarketCodeName: i.MktNm || "",
  }));
}

export async function getDailyQuotes(code: string, from?: string, to?: string): Promise<JQuantsQuote[]> {
  let path = `/equities/bars/daily?code=${toCode5(code)}`;
  if (from) path += `&from=${from}`;
  if (to) path += `&to=${to}`;
  const res = await jquantsFetch(path);
  const items: JQuantsBarItem[] = res.data || [];
  // 旧インターフェースに変換
  return items.map((i) => ({
    Code: i.Code,
    Date: i.Date,
    Open: i.AdjO ?? i.O,
    High: i.AdjH ?? i.H,
    Low: i.AdjL ?? i.L,
    Close: i.AdjC ?? i.C,
    Volume: i.AdjVo ?? i.Vo,
    AdjustmentClose: i.AdjC ?? i.C,
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
