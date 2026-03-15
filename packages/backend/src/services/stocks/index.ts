import * as jquants from "./jquants.js";
import * as finnhub from "./finnhub.js";
import type { StockQuote, CandleData } from "@kabu-trade/shared";
import type { Market } from "@prisma/client";

export async function getQuote(symbol: string, market: Market): Promise<StockQuote> {
  if (market === "US") {
    const q = await finnhub.getQuote(symbol);
    return {
      symbol,
      market: "US",
      price: q.c,
      change: q.d,
      changePercent: q.dp,
      high: q.h,
      low: q.l,
      open: q.o,
      previousClose: q.pc,
      timestamp: q.t * 1000,
    };
  }

  const quotes = await jquants.getDailyQuotes(symbol);
  const latest = quotes[quotes.length - 1];
  if (!latest) throw new Error(`No data for ${symbol}`);

  const prevClose = quotes.length > 1 ? quotes[quotes.length - 2].Close : latest.Open;
  return {
    symbol,
    market: "JP",
    price: latest.Close,
    change: latest.Close - prevClose,
    changePercent: ((latest.Close - prevClose) / prevClose) * 100,
    high: latest.High,
    low: latest.Low,
    open: latest.Open,
    previousClose: prevClose,
    volume: latest.Volume,
    timestamp: new Date(latest.Date).getTime(),
  };
}

export async function getCandles(
  symbol: string,
  market: Market,
  days: number = 90
): Promise<CandleData[]> {
  if (market === "US") {
    const to = Math.floor(Date.now() / 1000);
    const from = to - days * 86400;
    const data = await finnhub.getCandles(symbol, "D", from, to);
    if (data.s !== "ok" || !data.t) return [];
    return data.t.map((t, i) => ({
      time: t,
      open: data.o[i],
      high: data.h[i],
      low: data.l[i],
      close: data.c[i],
      volume: data.v[i],
    }));
  }

  const now = new Date();
  const fromDate = new Date(now.getTime() - days * 86400000);
  const from = fromDate.toISOString().split("T")[0].replace(/-/g, "");
  const to = now.toISOString().split("T")[0].replace(/-/g, "");
  const quotes = await jquants.getDailyQuotes(symbol, from, to);
  return quotes.map((q) => ({
    time: new Date(q.Date).getTime() / 1000,
    open: q.Open,
    high: q.High,
    low: q.Low,
    close: q.Close,
    volume: q.Volume,
  }));
}

export async function searchSymbols(
  query: string,
  market: Market
): Promise<{ symbol: string; name: string }[]> {
  if (market === "US") {
    const results = await finnhub.searchSymbol(query);
    return results.slice(0, 20).map((r) => ({
      symbol: r.symbol,
      name: r.description,
    }));
  }

  const info = await jquants.getListedInfo();
  const q = query.toLowerCase();
  return info
    .filter(
      (i) =>
        i.Code.includes(query) ||
        i.CompanyName.toLowerCase().includes(q) ||
        i.CompanyNameEnglish.toLowerCase().includes(q)
    )
    .slice(0, 20)
    .map((i) => ({ symbol: i.Code, name: i.CompanyName }));
}
