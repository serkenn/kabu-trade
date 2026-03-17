import type { CandleData } from "@kabu-trade/shared";

const STOOQ_BASE_URL = "https://stooq.com/q/d/l/";
const DEFAULT_USDJPY_RATE = 150;

interface FxCsvCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0].replace(/-/g, "");
}

function parseConfiguredRate(): number {
  const raw = process.env.FX_USDJPY_RATE;
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return DEFAULT_USDJPY_RATE;
}

function normalizeCandles(candles: FxCsvCandle[]): CandleData[] {
  return candles.map((c) => ({
    time: c.date,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: 0,
  }));
}

function buildFallbackCandles(days: number, rate: number): CandleData[] {
  const candles: CandleData[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split("T")[0];
    candles.push({
      time: date,
      open: rate,
      high: rate,
      low: rate,
      close: rate,
      volume: 0,
    });
  }
  return candles;
}

async function fetchStooqFxCandles(days: number): Promise<FxCsvCandle[]> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  const d1 = formatDate(from);
  const d2 = formatDate(to);

  const res = await fetch(`${STOOQ_BASE_URL}?s=usdjpy&d1=${d1}&d2=${d2}&i=d`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; KabuTrade/1.0)",
    },
  });

  if (!res.ok) {
    throw new Error(`Stooq FX error: ${res.status}`);
  }

  const text = await res.text();
  const lines = text.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("Stooq FX returned no data");
  }

  const candles: FxCsvCandle[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length < 5) continue;
    const [date, open, high, low, close] = parts;
    const o = Number(open);
    const h = Number(high);
    const l = Number(low);
    const c = Number(close);
    if (![o, h, l, c].every((v) => Number.isFinite(v) && v > 0)) continue;
    candles.push({ date, open: o, high: h, low: l, close: c });
  }

  candles.sort((a, b) => a.date.localeCompare(b.date));
  if (candles.length === 0) {
    throw new Error("Stooq FX parsed zero candles");
  }
  return candles;
}

export async function getUsdJpyCandles(days: number = 90) {
  const fallbackRate = parseConfiguredRate();
  try {
    const candles = await fetchStooqFxCandles(days);
    return {
      pair: "USD/JPY",
      source: "stooq" as const,
      candles: normalizeCandles(candles),
    };
  } catch {
    return {
      pair: "USD/JPY",
      source: "fallback" as const,
      candles: buildFallbackCandles(days, fallbackRate),
    };
  }
}

export async function getUsdJpyQuote() {
  const result = await getUsdJpyCandles(30);
  const candles = result.candles;
  const latest = candles[candles.length - 1];
  const prev = candles.length > 1 ? candles[candles.length - 2] : latest;
  const change = latest.close - prev.close;
  const changePercent = prev.close > 0 ? (change / prev.close) * 100 : 0;

  return {
    pair: result.pair,
    source: result.source,
    rate: latest.close,
    previousClose: prev.close,
    change,
    changePercent,
    timestamp: Date.now(),
  };
}
