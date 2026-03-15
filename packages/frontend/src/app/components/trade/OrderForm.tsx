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
          side === "BUY" ? "買い" : "売り"
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
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h3 className="font-bold text-lg">注文</h3>

      {/* 売買区分 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSide("BUY")}
          className={`py-2 rounded-lg font-bold transition-colors ${
            side === "BUY"
              ? "bg-red-600 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
          }`}
        >
          買い
        </button>
        <button
          type="button"
          onClick={() => setSide("SELL")}
          className={`py-2 rounded-lg font-bold transition-colors ${
            side === "SELL"
              ? "bg-green-600 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
          }`}
        >
          売り
        </button>
      </div>

      {/* 取引種別 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTradeType("SPOT")}
          className={`py-1.5 rounded text-sm transition-colors ${
            tradeType === "SPOT"
              ? "bg-brand-600 text-white"
              : "bg-gray-800 text-gray-400"
          }`}
        >
          現物
        </button>
        <button
          type="button"
          onClick={() => setTradeType("MARGIN")}
          className={`py-1.5 rounded text-sm transition-colors ${
            tradeType === "MARGIN"
              ? "bg-yellow-600 text-white"
              : "bg-gray-800 text-gray-400"
          }`}
        >
          信用
        </button>
      </div>

      {/* 注文タイプ */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setOrderType("MARKET")}
          className={`py-1.5 rounded text-sm transition-colors ${
            orderType === "MARKET"
              ? "bg-gray-600 text-white"
              : "bg-gray-800 text-gray-400"
          }`}
        >
          成行
        </button>
        <button
          type="button"
          onClick={() => setOrderType("LIMIT")}
          className={`py-1.5 rounded text-sm transition-colors ${
            orderType === "LIMIT"
              ? "bg-gray-600 text-white"
              : "bg-gray-800 text-gray-400"
          }`}
        >
          指値
        </button>
      </div>

      {/* 数量 */}
      <div>
        <label className="label">数量（株）</label>
        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="input"
          placeholder="100"
          required
        />
      </div>

      {/* 指値価格 */}
      {orderType === "LIMIT" && (
        <div>
          <label className="label">指値価格</label>
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="input"
            placeholder={quote?.price.toString()}
            required
          />
        </div>
      )}

      {/* 概算金額 */}
      {estimatedTotal > 0 && (
        <div className="text-sm text-gray-400">
          概算金額:{" "}
          <span className="text-white font-medium">
            {quote?.market === "US" ? "$" : "¥"}
            {estimatedTotal.toLocaleString()}
          </span>
          {tradeType === "MARGIN" && (
            <span className="text-yellow-400 ml-2">
              (証拠金: {quote?.market === "US" ? "$" : "¥"}
              {Math.floor(estimatedTotal / 3).toLocaleString()})
            </span>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {success && <p className="text-green-400 text-sm">{success}</p>}

      <button
        type="submit"
        disabled={loading || !quote || !quantity}
        className={`w-full py-3 rounded-lg font-bold transition-colors ${
          side === "BUY"
            ? "bg-red-600 hover:bg-red-700 text-white"
            : "bg-green-600 hover:bg-green-700 text-white"
        } disabled:opacity-50`}
      >
        {loading
          ? "処理中..."
          : `${side === "BUY" ? "買い" : "売り"}注文${
              tradeType === "MARGIN" ? "（信用）" : ""
            }`}
      </button>
    </form>
  );
}
