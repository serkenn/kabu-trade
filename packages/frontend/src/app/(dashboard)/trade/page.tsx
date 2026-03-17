"use client";

import { useState, useCallback } from "react";
import StockSearch from "@/app/components/trade/StockSearch";
import QuoteDisplay from "@/app/components/trade/QuoteDisplay";
import OrderForm from "@/app/components/trade/OrderForm";
import PriceChart from "@/app/components/charts/PriceChart";
import MarketClock from "@/app/components/trade/MarketClock";
import Watchlist from "@/app/components/trade/Watchlist";
import { useAuth } from "@/hooks/useAuth";
import type { StockQuote } from "@/types";

export default function TradePage() {
  const [market, setMarket] = useState<"JP" | "US">("JP");
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chart" | "order" | "watchlist">("chart");
  const { user, fetchUser } = useAuth();

  const loadQuote = useCallback(
    async (symbol: string, mkt?: "JP" | "US", name?: string) => {
      const m = mkt || market;
      if (mkt && mkt !== market) setMarket(mkt);
      setSelectedSymbol(symbol);
      if (name !== undefined) setSelectedName(name);
      setQuoteLoading(true);
      try {
        const res = await fetch(
          `/api/stocks/quote?symbol=${symbol}&market=${m}`
        );
        if (res.ok) {
          const q = await res.json();
          if (name) q.name = name;
          setQuote(q);
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
      <div className="flex items-center gap-2 md:gap-3 px-2 md:px-3 py-2 bg-gray-900 border-b border-gray-800 shrink-0" style={{ overflowX: "clip" }}>
        {/* Market toggle */}
        <div className="flex bg-gray-800 rounded overflow-hidden shrink-0">
          <button
            onClick={() => { setMarket("JP"); setQuote(null); setSelectedSymbol(""); }}
            className={`px-3 py-1.5 md:py-1 text-xs font-bold transition-colors ${
              market === "JP" ? "bg-brand-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            JP
          </button>
          <button
            onClick={() => { setMarket("US"); setQuote(null); setSelectedSymbol(""); }}
            className={`px-3 py-1.5 md:py-1 text-xs font-bold transition-colors ${
              market === "US" ? "bg-brand-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            US
          </button>
        </div>

        {/* Search */}
        <div className="w-40 md:w-64 shrink-0 relative z-50">
          <StockSearch market={market} onSelect={(s, name) => loadQuote(s, undefined, name)} />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Market clock - desktop only */}
        <div className="hidden md:block">
          <MarketClock />
        </div>

        {/* Balance */}
        <div className="text-xs text-gray-400 flex items-center gap-2 border-l border-gray-700 pl-2 md:pl-3 shrink-0">
          <span className="hidden md:inline">残高</span>
          <span className="text-white font-bold font-mono text-[11px] md:text-xs">
            ¥{(user?.balance || 0).toLocaleString()}
          </span>
          {(user?.balanceUsd || 0) > 0 && (
            <span className="text-white font-bold font-mono text-[11px] md:text-xs">
              ${(user?.balanceUsd || 0).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Mobile tab switcher */}
      <div className="md:hidden flex bg-gray-900 border-b border-gray-800 shrink-0">
        {(["chart", "order", "watchlist"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
              mobileTab === tab
                ? "text-brand-400 border-b-2 border-brand-500"
                : "text-gray-500"
            }`}
          >
            {tab === "chart" ? "チャート" : tab === "order" ? "注文" : "お気に入り"}
          </button>
        ))}
      </div>

      {/* Main content: chart + order panel */}
      <div className="flex-1 flex min-h-0">
        {/* Left: quote header + chart */}
        <div className={`flex-1 flex flex-col min-w-0 ${mobileTab !== "chart" ? "hidden md:flex" : ""}`}>
          {/* Quote strip */}
          <QuoteDisplay quote={quote} loading={quoteLoading} />

          {/* Chart area */}
          <div className="flex-1 min-h-0">
            {selectedSymbol ? (
              <PriceChart symbol={selectedSymbol} market={market} />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-600 text-sm px-4 text-center">
                銘柄を検索して選択してください
              </div>
            )}
          </div>
        </div>

        {/* Right: order panel + watchlist (desktop: always visible, mobile: tab-based) */}
        <div className={`w-full md:w-72 border-l-0 md:border-l border-gray-800 bg-gray-900 overflow-y-auto shrink-0 flex flex-col ${
          mobileTab === "chart" ? "hidden md:flex" : ""
        }`}>
          <div className={mobileTab === "watchlist" ? "hidden md:block" : ""}>
            <OrderForm quote={quote} onOrderPlaced={handleOrderPlaced} />
          </div>
          <div className="flex-1" />
          <div className={mobileTab === "order" ? "hidden md:block" : ""}>
            <Watchlist
              currentSymbol={selectedSymbol}
              currentMarket={market}
              currentName={quote?.name || selectedName}
              onSelect={(symbol, mkt) => { loadQuote(symbol, mkt); setMobileTab("chart"); }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
