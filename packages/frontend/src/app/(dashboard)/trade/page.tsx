"use client";

import { useState, useCallback } from "react";
import StockSearch from "@/app/components/trade/StockSearch";
import QuoteDisplay from "@/app/components/trade/QuoteDisplay";
import OrderForm from "@/app/components/trade/OrderForm";
import PriceChart from "@/app/components/charts/PriceChart";
import MarketClock from "@/app/components/trade/MarketClock";
import { useAuth } from "@/hooks/useAuth";
import type { StockQuote } from "@/types";

export default function TradePage() {
  const [market, setMarket] = useState<"JP" | "US">("JP");
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const { user, fetchUser } = useAuth();

  const loadQuote = useCallback(
    async (symbol: string) => {
      setSelectedSymbol(symbol);
      setQuoteLoading(true);
      try {
        const res = await fetch(
          `/api/stocks/quote?symbol=${symbol}&market=${market}`
        );
        if (res.ok) {
          setQuote(await res.json());
        }
      } catch {
        // ignore
      } finally {
        setQuoteLoading(false);
      }
    },
    [market]
  );

  const handleOrderPlaced = () => {
    fetchUser();
    if (selectedSymbol) loadQuote(selectedSymbol);
  };

  return (
    <div className="h-full flex flex-col gap-0">
      {/* Top toolbar */}
      <div className="flex items-center gap-3 px-3 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
        {/* Market toggle */}
        <div className="flex bg-gray-800 rounded overflow-hidden">
          <button
            onClick={() => { setMarket("JP"); setQuote(null); setSelectedSymbol(""); }}
            className={`px-3 py-1 text-xs font-bold transition-colors ${
              market === "JP" ? "bg-brand-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            JP
          </button>
          <button
            onClick={() => { setMarket("US"); setQuote(null); setSelectedSymbol(""); }}
            className={`px-3 py-1 text-xs font-bold transition-colors ${
              market === "US" ? "bg-brand-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            US
          </button>
        </div>

        {/* Search */}
        <div className="w-64">
          <StockSearch market={market} onSelect={loadQuote} />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Market clock inline */}
        <MarketClock />

        {/* Balance */}
        <div className="text-xs text-gray-400 flex items-center gap-2 border-l border-gray-700 pl-3">
          <span>残高</span>
          <span className="text-white font-bold font-mono">
            ¥{(user?.balance || 0).toLocaleString()}
          </span>
          {(user?.balanceUsd || 0) > 0 && (
            <span className="text-white font-bold font-mono">
              ${(user?.balanceUsd || 0).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Main content: chart + order panel */}
      <div className="flex-1 flex min-h-0">
        {/* Left: quote header + chart */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Quote strip */}
          <QuoteDisplay quote={quote} loading={quoteLoading} />

          {/* Chart area */}
          <div className="flex-1 min-h-0">
            {selectedSymbol ? (
              <PriceChart symbol={selectedSymbol} market={market} />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-600 text-sm">
                銘柄を検索して選択してください
              </div>
            )}
          </div>
        </div>

        {/* Right: order panel */}
        <div className="w-72 border-l border-gray-800 bg-gray-900 overflow-y-auto shrink-0">
          <OrderForm quote={quote} onOrderPlaced={handleOrderPlaced} />
        </div>
      </div>
    </div>
  );
}
