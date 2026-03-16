"use client";

import { useState } from "react";
import type { StockQuote } from "@/types";

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "注文に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const estimatedTotal =
    quote && quantity
      ? (orderType === "LIMIT" && price
          ? parseFloat(price)
          : quote.price) * parseInt(quantity || "0")
      : 0;

  return (
    <form onSubmit={handleSubmit} className="p-3 space-y-3 text-sm">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">注文</div>

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
          買い
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
          売り
        </button>
      </div>

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
