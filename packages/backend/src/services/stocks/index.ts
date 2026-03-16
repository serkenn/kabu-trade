import * as nikkei from "./nikkei.js";
import * as stooq from "./stooq.js";
import type { StockQuote, CandleData } from "@kabu-trade/shared";
import type { Market } from "@prisma/client";

export async function getQuote(symbol: string, market: Market): Promise<StockQuote> {
  if (market === "US") {
    // US株: Stooq から最新データ取得
    const q = await stooq.getLatestQuote(symbol, "US");
    return {
      symbol,
      market: "US",
      price: q.price,
      change: q.change,
      changePercent: q.changePercent,
      high: q.high,
      low: q.low,
      open: q.open,
      previousClose: q.previousClose,
      volume: q.volume,
      timestamp: q.timestamp,
    };
  }

  // JP株: 日経 → Stooq フォールバック
  try {
    const q = await nikkei.getQuote(symbol);
    return {
      symbol,
      market: "JP",
      name: q.name,
      price: q.price,
      change: q.change,
      changePercent: q.changePercent,
      high: q.high,
      low: q.low,
      open: q.open,
      previousClose: q.previousClose,
      volume: q.volume,
      timestamp: q.timestamp,
    };
  } catch (e) {
    console.warn(`[quote] Nikkei failed for ${symbol}, trying Stooq:`, e);
    const q = await stooq.getLatestQuote(symbol, "JP");
    return {
      symbol,
      market: "JP",
      price: q.price,
      change: q.change,
      changePercent: q.changePercent,
      high: q.high,
      low: q.low,
      open: q.open,
      previousClose: q.previousClose,
      volume: q.volume,
      timestamp: q.timestamp,
    };
  }
}

/**
 * interval: "1m","5m","10m","15m","30m","1h","2h","3h","4h" → イントラデイ
 *           undefined → 日足
 */
function parseIntervalMin(interval?: string): number | null {
  if (!interval) return null;
  const m = interval.match(/^(\d+)(m|h)$/);
  if (!m) return null;
  const val = parseInt(m[1]);
  return m[2] === "h" ? val * 60 : val;
}

export async function getCandles(
  symbol: string,
  market: Market,
  days: number = 90,
  interval?: string
): Promise<CandleData[]> {
  const intervalMin = parseIntervalMin(interval);

  // イントラデイ (JP株のみ、日経1分足から生成)
  if (intervalMin !== null && market === "JP") {
    const candles = await nikkei.getIntradayCandles(symbol, intervalMin);
    return candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
  }

  if (market === "US") {
    const candles = await stooq.getCandles(symbol, "US", days);
    return candles.map((c) => ({
      time: c.date,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
  }

  // JP株日足: 日経 → Stooq フォールバック
  try {
    const candles = await nikkei.getCandles(symbol, days);
    if (candles.length > 0) return candles;
  } catch (e) {
    console.warn(`[candles] Nikkei failed for ${symbol}, trying Stooq:`, e);
  }

  const candles = await stooq.getCandles(symbol, "JP", days);
  return candles.map((c) => ({
    time: c.date,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));
}

export async function searchSymbols(
  query: string,
  market: Market
): Promise<{ symbol: string; name: string }[]> {
  if (market === "US") {
    return searchLocalUSStocks(query);
  }
  return searchLocalJPStocks(query);
}

// ==================== ローカル銘柄リスト ====================

interface Stock { code: string; name: string; }

const JP_STOCKS: Stock[] = [
  { code: "7203", name: "トヨタ自動車" },
  { code: "6758", name: "ソニーグループ" },
  { code: "9984", name: "ソフトバンクグループ" },
  { code: "6861", name: "キーエンス" },
  { code: "8306", name: "三菱UFJフィナンシャル・グループ" },
  { code: "6501", name: "日立製作所" },
  { code: "7741", name: "HOYA" },
  { code: "6098", name: "リクルートホールディングス" },
  { code: "9432", name: "日本電信電話" },
  { code: "6902", name: "デンソー" },
  { code: "7974", name: "任天堂" },
  { code: "4063", name: "信越化学工業" },
  { code: "8035", name: "東京エレクトロン" },
  { code: "6981", name: "村田製作所" },
  { code: "9433", name: "KDDI" },
  { code: "4502", name: "武田薬品工業" },
  { code: "6954", name: "ファナック" },
  { code: "7267", name: "本田技研工業" },
  { code: "8058", name: "三菱商事" },
  { code: "9434", name: "ソフトバンク" },
  { code: "3382", name: "セブン&アイ・ホールディングス" },
  { code: "6367", name: "ダイキン工業" },
  { code: "4568", name: "第一三共" },
  { code: "6594", name: "日本電産" },
  { code: "7751", name: "キヤノン" },
  { code: "6971", name: "京セラ" },
  { code: "8801", name: "三井不動産" },
  { code: "2914", name: "日本たばこ産業" },
  { code: "4519", name: "中外製薬" },
  { code: "6857", name: "アドバンテスト" },
  { code: "9983", name: "ファーストリテイリング" },
  { code: "4661", name: "オリエンタルランド" },
  { code: "6723", name: "ルネサスエレクトロニクス" },
  { code: "6920", name: "レーザーテック" },
  { code: "8766", name: "東京海上ホールディングス" },
  { code: "6762", name: "TDK" },
  { code: "3407", name: "旭化成" },
  { code: "5401", name: "日本製鉄" },
  { code: "8316", name: "三井住友フィナンシャルグループ" },
  { code: "8411", name: "みずほフィナンシャルグループ" },
  { code: "2801", name: "キッコーマン" },
  { code: "4901", name: "富士フイルムホールディングス" },
  { code: "6301", name: "小松製作所" },
  { code: "7011", name: "三菱重工業" },
  { code: "1925", name: "大和ハウス工業" },
  { code: "2502", name: "アサヒグループホールディングス" },
  { code: "3659", name: "ネクソン" },
  { code: "4543", name: "テルモ" },
  { code: "4578", name: "大塚ホールディングス" },
  { code: "6503", name: "三菱電機" },
  { code: "7269", name: "スズキ" },
  { code: "7270", name: "SUBARU" },
  { code: "8031", name: "三井物産" },
  { code: "8053", name: "住友商事" },
  { code: "8591", name: "オリックス" },
  { code: "9613", name: "NTTデータグループ" },
  { code: "2413", name: "エムスリー" },
  { code: "4151", name: "協和キリン" },
  { code: "4307", name: "野村総合研究所" },
  { code: "4452", name: "花王" },
  { code: "4503", name: "アステラス製薬" },
  { code: "4507", name: "塩野義製薬" },
  { code: "4911", name: "資生堂" },
  { code: "5108", name: "ブリヂストン" },
  { code: "6273", name: "SMC" },
  { code: "6326", name: "クボタ" },
  { code: "6506", name: "安川電機" },
  { code: "6752", name: "パナソニック ホールディングス" },
  { code: "6988", name: "日東電工" },
  { code: "7201", name: "日産自動車" },
  { code: "7832", name: "バンダイナムコホールディングス" },
  { code: "8001", name: "伊藤忠商事" },
  { code: "8015", name: "豊田通商" },
  { code: "8697", name: "日本取引所グループ" },
  { code: "9020", name: "東日本旅客鉄道" },
  { code: "9021", name: "西日本旅客鉄道" },
  { code: "9022", name: "東海旅客鉄道" },
  { code: "9101", name: "日本郵船" },
  { code: "9104", name: "商船三井" },
  { code: "9107", name: "川崎汽船" },
  { code: "9201", name: "日本航空" },
  { code: "9202", name: "ANAホールディングス" },
  { code: "2802", name: "味の素" },
  { code: "3099", name: "三越伊勢丹ホールディングス" },
  { code: "4689", name: "LINEヤフー" },
  { code: "7733", name: "オリンパス" },
  { code: "1605", name: "INPEX" },
  { code: "5020", name: "ENEOSホールディングス" },
  { code: "6146", name: "ディスコ" },
  { code: "6526", name: "ソシオネクスト" },
  { code: "4755", name: "楽天グループ" },
  { code: "2432", name: "ディー・エヌ・エー" },
  { code: "3778", name: "さくらインターネット" },
  { code: "6702", name: "富士通" },
  { code: "6701", name: "NEC" },
  { code: "4528", name: "小野薬品工業" },
  { code: "6479", name: "ミネベアミツミ" },
  { code: "6645", name: "オムロン" },
  { code: "7182", name: "ゆうちょ銀行" },
  { code: "6753", name: "シャープ" },
  { code: "3086", name: "J.フロント リテイリング" },
];

const US_STOCKS: Stock[] = [
  { code: "AAPL", name: "Apple Inc." },
  { code: "MSFT", name: "Microsoft Corporation" },
  { code: "GOOGL", name: "Alphabet Inc." },
  { code: "AMZN", name: "Amazon.com Inc." },
  { code: "NVDA", name: "NVIDIA Corporation" },
  { code: "META", name: "Meta Platforms Inc." },
  { code: "TSLA", name: "Tesla Inc." },
  { code: "BRK.B", name: "Berkshire Hathaway Inc." },
  { code: "JPM", name: "JPMorgan Chase & Co." },
  { code: "V", name: "Visa Inc." },
  { code: "JNJ", name: "Johnson & Johnson" },
  { code: "WMT", name: "Walmart Inc." },
  { code: "MA", name: "Mastercard Inc." },
  { code: "PG", name: "Procter & Gamble Co." },
  { code: "HD", name: "The Home Depot Inc." },
  { code: "DIS", name: "The Walt Disney Company" },
  { code: "BAC", name: "Bank of America Corp." },
  { code: "ADBE", name: "Adobe Inc." },
  { code: "CRM", name: "Salesforce Inc." },
  { code: "NFLX", name: "Netflix Inc." },
  { code: "AMD", name: "Advanced Micro Devices" },
  { code: "INTC", name: "Intel Corporation" },
  { code: "CSCO", name: "Cisco Systems Inc." },
  { code: "PEP", name: "PepsiCo Inc." },
  { code: "KO", name: "The Coca-Cola Company" },
  { code: "NKE", name: "Nike Inc." },
  { code: "MRK", name: "Merck & Co. Inc." },
  { code: "ABBV", name: "AbbVie Inc." },
  { code: "T", name: "AT&T Inc." },
  { code: "VZ", name: "Verizon Communications" },
  { code: "ORCL", name: "Oracle Corporation" },
  { code: "COST", name: "Costco Wholesale Corp." },
  { code: "AVGO", name: "Broadcom Inc." },
  { code: "TXN", name: "Texas Instruments" },
  { code: "QCOM", name: "Qualcomm Inc." },
  { code: "UNH", name: "UnitedHealth Group" },
  { code: "LLY", name: "Eli Lilly and Company" },
  { code: "BA", name: "The Boeing Company" },
  { code: "CAT", name: "Caterpillar Inc." },
  { code: "GS", name: "Goldman Sachs Group" },
  { code: "PYPL", name: "PayPal Holdings Inc." },
  { code: "UBER", name: "Uber Technologies" },
  { code: "SQ", name: "Block Inc." },
  { code: "COIN", name: "Coinbase Global Inc." },
  { code: "PLTR", name: "Palantir Technologies" },
  { code: "SNOW", name: "Snowflake Inc." },
  { code: "SHOP", name: "Shopify Inc." },
  { code: "SPOT", name: "Spotify Technology" },
  { code: "ZM", name: "Zoom Video Communications" },
  { code: "ROKU", name: "Roku Inc." },
];

function searchLocalJPStocks(query: string): { symbol: string; name: string }[] {
  const q = query.toLowerCase();
  return JP_STOCKS
    .filter((s) => s.code.includes(query) || s.name.toLowerCase().includes(q))
    .slice(0, 20)
    .map((s) => ({ symbol: s.code, name: s.name }));
}

function searchLocalUSStocks(query: string): { symbol: string; name: string }[] {
  const q = query.toLowerCase();
  return US_STOCKS
    .filter((s) => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    .slice(0, 20)
    .map((s) => ({ symbol: s.code, name: s.name }));
}
