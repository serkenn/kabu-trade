"use client";

import type { StockQuote } from "@/types";

interface Props {
  quote: StockQuote | null;
  loading: boolean;
}

export default function QuoteDisplay({ quote, loading }: Props) {
  if (loading) {
    return (
      <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-4">
        <div className="h-4 bg-gray-800 rounded w-20 animate-pulse" />
        <div className="h-5 bg-gray-800 rounded w-24 animate-pulse" />
      </div>
    );
  }

  if (!quote) {
    return <div className="h-12 bg-gray-900 border-b border-gray-800" />;
  }

  const isUp = quote.change >= 0;
  const isJP = quote.market === "JP";
  const colorClass = isJP
    ? isUp ? "text-red-400" : "text-green-400"
    : isUp ? "text-green-400" : "text-red-400";
  const bgClass = isJP
    ? isUp ? "bg-red-500/10" : "bg-green-500/10"
    : isUp ? "bg-green-500/10" : "bg-red-500/10";
  const currency = isJP ? "¥" : "$";

  return (
    <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center gap-6 shrink-0 overflow-x-auto">
      {/* Symbol + name */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-lg font-bold font-mono text-white">{quote.symbol}</span>
        {quote.name && (
          <span className="text-xs text-gray-400 max-w-[200px] truncate">{quote.name}</span>
        )}
        <span className="text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">
          {isJP ? "東証" : "NASDAQ"}
        </span>
      </div>

      {/* Price + change */}
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="text-xl font-bold font-mono text-white">
          {currency}
          {quote.price.toLocaleString(undefined, {
            minimumFractionDigits: isJP ? 0 : 2,
            maximumFractionDigits: isJP ? 0 : 2,
          })}
        </span>
        <span className={`text-sm font-bold font-mono px-1.5 py-0.5 rounded ${colorClass} ${bgClass}`}>
          {isUp ? "+" : ""}
          {quote.change.toFixed(isJP ? 0 : 2)} ({isUp ? "+" : ""}
          {quote.changePercent.toFixed(2)}%)
        </span>
      </div>

      {/* OHLC bar */}
      <div className="flex items-center gap-4 text-xs shrink-0">
        <div>
          <span className="text-gray-500">始値 </span>
          <span className="font-mono text-gray-300">{currency}{quote.open.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-gray-500">高値 </span>
          <span className="font-mono text-red-400">{currency}{quote.high.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-gray-500">安値 </span>
          <span className="font-mono text-green-400">{currency}{quote.low.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-gray-500">前日終値 </span>
          <span className="font-mono text-gray-300">{currency}{quote.previousClose.toLocaleString()}</span>
        </div>
        {quote.volume && (
          <div>
            <span className="text-gray-500">出来高 </span>
            <span className="font-mono text-gray-300">{quote.volume.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
