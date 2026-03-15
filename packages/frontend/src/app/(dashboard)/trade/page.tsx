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
    <div className="space-y-6">
      <MarketClock />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">取引</h1>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">
            残高:{" "}
            <span className="text-white font-bold">
              ¥{(user?.balance || 0).toLocaleString()}
            </span>
            {(user?.balanceUsd || 0) > 0 && (
              <span className="ml-3 text-white font-bold">
                ${(user?.balanceUsd || 0).toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex bg-gray-800 rounded-lg overflow-hidden">
            <button
              onClick={() => {
                setMarket("JP");
                setQuote(null);
                setSelectedSymbol("");
              }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                market === "JP"
                  ? "bg-brand-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              日本株
            </button>
            <button
              onClick={() => {
                setMarket("US");
                setQuote(null);
                setSelectedSymbol("");
              }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                market === "US"
                  ? "bg-brand-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              米国株
            </button>
          </div>
        </div>
      </div>

      <StockSearch market={market} onSelect={loadQuote} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <QuoteDisplay quote={quote} loading={quoteLoading} />
          {selectedSymbol && (
            <PriceChart symbol={selectedSymbol} market={market} />
          )}
        </div>
        <div>
          <OrderForm quote={quote} onOrderPlaced={handleOrderPlaced} />
        </div>
      </div>
    </div>
  );
}
