"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { StockQuote } from "@/types";

interface Holding {
  symbol: string;
  market: string;
  quantity: number;
  avgCost: number;
}

interface Props {
  quote: StockQuote | null;
  onOrderPlaced: () => void;
}

export default function OrderForm({ quote, onOrderPlaced }: Props) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [tradeType, setTradeType] = useState<"SPOT" | "MARGIN">("SPOT");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const quantityRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Fetch holdings for sell balance display
  useEffect(() => {
    fetch("/api/trade/holdings")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setHoldings(data); })
      .catch(() => {});
  }, []);

  // Refresh holdings after order placed
  const refreshHoldings = useCallback(() => {
    fetch("/api/trade/holdings")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setHoldings(data); })
      .catch(() => {});
  }, []);

  const currentHolding = quote
    ? holdings.find((h) => h.symbol === quote.symbol && h.market === quote.market)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/trade/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: quote.symbol,
          market: quote.market,
          side,
          type: orderType,
          tradeType,
          quantity: parseInt(quantity),
          price: orderType === "LIMIT" ? parseFloat(price) : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      const order = await res.json();
      setSuccess(
        `${order.status === "FILLED" ? "約定" : "注文受付"}: ${quote.symbol} ${quantity}株 ${
          side === "BUY" ? "買" : "売"
        }${order.filledPrice ? ` @${order.filledPrice.toLocaleString()}` : ""}`
      );
      setQuantity("");
      setPrice("");
      onOrderPlaced();
      refreshHoldings();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "注文に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs (except our own)
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
        // Allow Enter to submit from our quantity/price inputs
        if (e.key === "Enter" && formRef.current?.contains(target)) {
          return; // Let form handle it
        }
        return;
      }

      switch (e.key) {
        case "b":
        case "B":
          e.preventDefault();
          setSide("BUY");
          quantityRef.current?.focus();
          break;
        case "s":
        case "S":
          e.preventDefault();
          setSide("SELL");
          quantityRef.current?.focus();
          break;
        case "m":
        case "M":
          e.preventDefault();
          setOrderType((prev) => prev === "MARKET" ? "LIMIT" : "MARKET");
          break;
        case "t":
        case "T":
          e.preventDefault();
          setTradeType((prev) => prev === "SPOT" ? "MARGIN" : "SPOT");
          break;
        case "q":
        case "Q":
          e.preventDefault();
          quantityRef.current?.focus();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const estimatedTotal =
    quote && quantity
      ? (orderType === "LIMIT" && price
          ? parseFloat(price)
          : quote.price) * parseInt(quantity || "0")
      : 0;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="p-3 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">注文</div>
        <div className="text-[9px] text-gray-600 hidden md:block" title="B=買い S=売り M=成行/指値 T=現物/信用 Q=数量">
          B/S/M/T/Q
        </div>
      </div>

      {/* Buy / Sell */}
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => setSide("BUY")}
          className={`py-2 rounded text-xs font-bold transition-colors ${
            side === "BUY"
              ? "bg-red-600 text-white"
              : "bg-gray-800 text-gray-500 hover:bg-gray-700"
          }`}
        >
          買い <span className="hidden md:inline text-[9px] opacity-60">(B)</span>
        </button>
        <button
          type="button"
          onClick={() => setSide("SELL")}
          className={`py-2 rounded text-xs font-bold transition-colors ${
            side === "SELL"
              ? "bg-green-600 text-white"
              : "bg-gray-800 text-gray-500 hover:bg-gray-700"
          }`}
        >
          売り <span className="hidden md:inline text-[9px] opacity-60">(S)</span>
        </button>
      </div>

      {/* Holdings balance for SELL */}
      {side === "SELL" && quote && (
        <div className="bg-gray-800/50 rounded px-2 py-1.5 flex justify-between items-center">
          <span className="text-[10px] text-gray-500">保有残高</span>
          <div className="text-right">
            {currentHolding ? (
              <div>
                <span className="font-mono font-bold text-white text-sm">
                  {currentHolding.quantity.toLocaleString()}
                </span>
                <span className="text-[10px] text-gray-400 ml-1">株</span>
                <button
                  type="button"
                  onClick={() => setQuantity(String(currentHolding.quantity))}
                  className="ml-2 text-[9px] text-brand-400 hover:text-brand-300 underline"
                >
                  全数量
                </button>
              </div>
            ) : (
              <span className="text-[10px] text-gray-600">保有なし</span>
            )}
          </div>
        </div>
      )}

      {/* Trade type + Order type */}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setTradeType("SPOT")}
          className={`flex-1 py-1 rounded text-[11px] transition-colors ${
            tradeType === "SPOT" ? "bg-brand-600 text-white" : "bg-gray-800 text-gray-500"
          }`}
        >
          現物
        </button>
        <button
          type="button"
          onClick={() => setTradeType("MARGIN")}
          className={`flex-1 py-1 rounded text-[11px] transition-colors ${
            tradeType === "MARGIN" ? "bg-yellow-600 text-white" : "bg-gray-800 text-gray-500"
          }`}
        >
          信用
        </button>
        <div className="w-px bg-gray-700" />
        <button
          type="button"
          onClick={() => setOrderType("MARKET")}
          className={`flex-1 py-1 rounded text-[11px] transition-colors ${
            orderType === "MARKET" ? "bg-gray-600 text-white" : "bg-gray-800 text-gray-500"
          }`}
        >
          成行
        </button>
        <button
          type="button"
          onClick={() => setOrderType("LIMIT")}
          className={`flex-1 py-1 rounded text-[11px] transition-colors ${
            orderType === "LIMIT" ? "bg-gray-600 text-white" : "bg-gray-800 text-gray-500"
          }`}
        >
          指値
        </button>
      </div>

      {/* Current price */}
      {quote && (
        <div className="bg-gray-800/50 rounded px-2 py-1.5 flex justify-between items-center">
          <span className="text-[10px] text-gray-500">現在値</span>
          <span className="font-mono font-bold text-white text-sm">
            {quote.market === "JP" ? "¥" : "$"}{quote.price.toLocaleString()}
          </span>
        </div>
      )}

      {/* Quantity */}
      <div>
        <label className="text-[10px] text-gray-500 mb-0.5 block">数量（株）</label>
        <input
          ref={quantityRef}
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="100"
          required
        />
      </div>

      {/* Limit price */}
      {orderType === "LIMIT" && (
        <div>
          <label className="text-[10px] text-gray-500 mb-0.5 block">指値価格</label>
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder={quote?.price.toString()}
            required
          />
        </div>
      )}

      {/* Estimated total */}
      {estimatedTotal > 0 && (
        <div className="bg-gray-800/50 rounded px-2 py-1.5">
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-500">概算金額</span>
            <span className="text-white font-mono font-bold">
              {quote?.market === "US" ? "$" : "¥"}{estimatedTotal.toLocaleString()}
            </span>
          </div>
          {tradeType === "MARGIN" && (
            <div className="flex justify-between text-[10px] mt-0.5">
              <span className="text-yellow-500">証拠金</span>
              <span className="text-yellow-400 font-mono">
                {quote?.market === "US" ? "$" : "¥"}{Math.floor(estimatedTotal / 3).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}
      {success && <p className="text-green-400 text-xs">{success}</p>}

      <button
        type="submit"
        disabled={loading || !quote || !quantity}
        className={`w-full py-2.5 rounded font-bold text-sm transition-colors ${
          side === "BUY"
            ? "bg-red-600 hover:bg-red-700 text-white"
            : "bg-green-600 hover:bg-green-700 text-white"
        } disabled:opacity-30`}
      >
        {loading
          ? "処理中..."
          : `${side === "BUY" ? "買い" : "売り"}注文${tradeType === "MARGIN" ? "（信用）" : ""}`}
      </button>
    </form>
  );
}
