"use client";

import type { StockQuote } from "@/types";

interface Props {
  quote: StockQuote | null;
  loading: boolean;
}

export default function QuoteDisplay({ quote, loading }: Props) {
  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-8 bg-gray-800 rounded w-32 mb-4" />
        <div className="h-12 bg-gray-800 rounded w-48" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="card text-center text-gray-500 py-12">
        銘柄を検索して選択してください
      </div>
    );
  }

  const isUp = quote.change >= 0;
  const isJP = quote.market === "JP";
  const colorClass = isJP
    ? isUp
      ? "text-up"
      : "text-down"
    : isUp
      ? "text-up-us"
      : "text-down-us";
  const currency = isJP ? "¥" : "$";

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold font-mono">{quote.symbol}</h2>
          {quote.name && <p className="text-sm text-gray-400">{quote.name}</p>}
          <span className="text-xs bg-gray-800 px-2 py-0.5 rounded mt-1 inline-block">
            {isJP ? "東証" : "NYSE/NASDAQ"}
          </span>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold font-mono">
            {currency}
            {quote.price.toLocaleString(undefined, {
              minimumFractionDigits: isJP ? 0 : 2,
              maximumFractionDigits: isJP ? 0 : 2,
            })}
          </p>
          <p className={`text-lg font-bold ${colorClass}`}>
            {isUp ? "+" : ""}
            {quote.change.toFixed(isJP ? 0 : 2)} ({isUp ? "+" : ""}
            {quote.changePercent.toFixed(2)}%)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-gray-500">始値</p>
          <p className="font-mono">
            {currency}
            {quote.open.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-gray-500">高値</p>
          <p className="font-mono text-up">
            {currency}
            {quote.high.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-gray-500">安値</p>
          <p className="font-mono text-down">
            {currency}
            {quote.low.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-gray-500">前日終値</p>
          <p className="font-mono">
            {currency}
            {quote.previousClose.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
