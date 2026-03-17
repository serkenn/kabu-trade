"use client";

import type { StockQuote } from "@/types";

/**
 * 日本株の値幅制限テーブル (東証ルール)
 */
const JP_PRICE_LIMITS: [number, number][] = [
  [100, 30], [200, 50], [500, 80], [700, 100], [1000, 150],
  [1500, 300], [2000, 400], [3000, 500], [5000, 700], [7000, 1000],
  [10000, 1500], [15000, 3000], [20000, 4000], [30000, 5000],
  [50000, 7000], [70000, 10000], [100000, 15000], [150000, 30000],
  [200000, 40000], [300000, 50000], [500000, 70000], [700000, 100000],
  [1000000, 150000], [1500000, 300000], [2000000, 400000],
  [3000000, 500000], [5000000, 700000], [7000000, 1000000],
  [10000000, 1500000], [15000000, 3000000], [20000000, 4000000],
  [30000000, 5000000], [50000000, 7000000], [Infinity, 10000000],
];

function getPriceLimit(previousClose: number): number {
  for (const [threshold, limit] of JP_PRICE_LIMITS) {
    if (previousClose < threshold) return limit;
  }
  return 10000000;
}

interface Props {
  quote: StockQuote | null;
  loading: boolean;
}

export default function QuoteDisplay({ quote, loading }: Props) {
  if (loading) {
    return (
      <div className="h-10 md:h-12 bg-gray-900 border-b border-gray-800 flex items-center px-3 md:px-4 gap-4">
        <div className="h-4 bg-gray-800 rounded w-20 animate-pulse" />
        <div className="h-5 bg-gray-800 rounded w-24 animate-pulse" />
      </div>
    );
  }

  if (!quote) {
    return <div className="h-10 md:h-12 bg-gray-900 border-b border-gray-800" />;
  }

  const isUp = quote.change >= 0;
  const isJP = quote.market === "JP";

  // ストップ高/安の計算 (日本株のみ)
  const priceLimit = isJP && quote.previousClose > 0 ? getPriceLimit(quote.previousClose) : null;
  const upperLimit = priceLimit !== null ? quote.previousClose + priceLimit : null;
  const lowerLimit = priceLimit !== null ? Math.max(1, quote.previousClose - priceLimit) : null;
  const isAtUpperLimit = upperLimit !== null && quote.price >= upperLimit;
  const isAtLowerLimit = lowerLimit !== null && quote.price <= lowerLimit;

  const colorClass = isJP
    ? isUp ? "text-red-400" : "text-green-400"
    : isUp ? "text-green-400" : "text-red-400";
  const bgClass = isJP
    ? isUp ? "bg-red-500/10" : "bg-green-500/10"
    : isUp ? "bg-green-500/10" : "bg-red-500/10";
  const currency = isJP ? "¥" : "$";

  return (
    <div className="bg-gray-900 border-b border-gray-800 px-2 md:px-4 py-1.5 md:py-2 shrink-0 overflow-hidden">
      <div className="flex items-center gap-2 md:gap-4 min-w-0">
        {/* Symbol + name */}
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          <span className="text-sm md:text-lg font-bold font-mono text-white">{quote.symbol}</span>
          {quote.name && (
            <span className="text-[10px] md:text-xs text-gray-400 max-w-[120px] md:max-w-[200px] truncate">{quote.name}</span>
          )}
          <span className="text-[9px] md:text-[10px] bg-gray-800 text-gray-500 px-1 md:px-1.5 py-0.5 rounded">
            {isJP ? "東証" : "NASDAQ"}
          </span>
        </div>

        {/* Price + change */}
        <div className="flex items-baseline gap-1.5 md:gap-2 shrink-0">
          <span className="text-base md:text-xl font-bold font-mono text-white">
            {currency}
            {quote.price.toLocaleString(undefined, {
              minimumFractionDigits: isJP ? 0 : 2,
              maximumFractionDigits: isJP ? 0 : 2,
            })}
          </span>
          <span className={`text-[10px] md:text-sm font-bold font-mono px-1 md:px-1.5 py-0.5 rounded ${colorClass} ${bgClass}`}>
            {isUp ? "+" : ""}
            {quote.change.toFixed(isJP ? 0 : 2)} ({isUp ? "+" : ""}
            {quote.changePercent.toFixed(2)}%)
          </span>
          {isAtUpperLimit && (
            <span className="text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white animate-pulse">
              S高
            </span>
          )}
          {isAtLowerLimit && (
            <span className="text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-600 text-white animate-pulse">
              S安
            </span>
          )}
        </div>

        {/* OHLC bar */}
        <div className="hidden sm:flex items-center gap-2 lg:gap-3 text-[10px] md:text-xs min-w-0">
          <div className="shrink-0">
            <span className="text-gray-500">始 </span>
            <span className="font-mono text-gray-300">{currency}{quote.open.toLocaleString()}</span>
          </div>
          <div className="shrink-0">
            <span className="text-gray-500">高 </span>
            <span className="font-mono text-red-400">{currency}{quote.high.toLocaleString()}</span>
          </div>
          <div className="shrink-0">
            <span className="text-gray-500">安 </span>
            <span className="font-mono text-green-400">{currency}{quote.low.toLocaleString()}</span>
          </div>
          <div className="hidden lg:block shrink-0">
            <span className="text-gray-500">前 </span>
            <span className="font-mono text-gray-300">{currency}{quote.previousClose.toLocaleString()}</span>
          </div>
          {quote.volume && (
            <div className="hidden xl:block shrink-0">
              <span className="text-gray-500">出来高 </span>
              <span className="font-mono text-gray-300">{quote.volume.toLocaleString()}</span>
            </div>
          )}
          {isJP && upperLimit && lowerLimit && (
            <>
              <div className="shrink-0">
                <span className="text-gray-500">S高 </span>
                <span className={`font-mono ${isAtUpperLimit ? "text-red-400 font-bold" : "text-gray-400"}`}>
                  ¥{upperLimit.toLocaleString()}
                </span>
              </div>
              <div className="shrink-0">
                <span className="text-gray-500">S安 </span>
                <span className={`font-mono ${isAtLowerLimit ? "text-green-400 font-bold" : "text-gray-400"}`}>
                  ¥{lowerLimit.toLocaleString()}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
