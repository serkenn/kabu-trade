"use client";

import { useEffect, useMemo, useState } from "react";

interface Props {
  balanceJpy: number;
  balanceUsd: number;
  onTradeComplete: () => void;
}

export default function FxForm({ balanceJpy, balanceUsd, onTradeComplete }: Props) {
  const [fromCurrency, setFromCurrency] = useState<"JPY" | "USD">("JPY");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState(150);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/trade/fx-rate")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.rate) setRate(data.rate);
      })
      .catch(() => {});
  }, []);

  const balance = fromCurrency === "JPY" ? balanceJpy : balanceUsd;
  const numericAmount = Number(amount || "0");

  const estimate = useMemo(() => {
    if (!(numericAmount > 0)) return null;
    if (fromCurrency === "JPY") {
      return {
        toCurrency: "USD" as const,
        received: Math.round((numericAmount / rate) * 100) / 100,
      };
    }
    return {
      toCurrency: "JPY" as const,
      received: Math.round(numericAmount * rate),
    };
  }, [fromCurrency, numericAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/trade/fx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromCurrency,
          toCurrency: fromCurrency === "JPY" ? "USD" : "JPY",
          amount: numericAmount,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "為替取引に失敗しました");

      setAmount("");
      setSuccess(
        `${data.fromCurrency} ${data.sourceAmount.toLocaleString()} -> ${data.toCurrency} ${data.receiveAmount.toLocaleString()}`
      );
      onTradeComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "為替取引に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 border-b border-gray-800 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">為替</div>
        <div className="text-[10px] text-gray-500">USD/JPY</div>
      </div>

      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => setFromCurrency("JPY")}
          className={`py-2 rounded text-xs font-bold transition-colors ${
            fromCurrency === "JPY"
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-500 hover:bg-gray-700"
          }`}
        >
          JPY→USD
        </button>
        <button
          type="button"
          onClick={() => setFromCurrency("USD")}
          className={`py-2 rounded text-xs font-bold transition-colors ${
            fromCurrency === "USD"
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-500 hover:bg-gray-700"
          }`}
        >
          USD→JPY
        </button>
      </div>

      <div className="bg-gray-800/50 rounded px-2 py-1.5 flex justify-between items-center text-[10px]">
        <span className="text-gray-500">利用可能残高</span>
        <span className="font-mono text-white font-bold">
          {fromCurrency === "JPY" ? "¥" : "$"}{balance.toLocaleString()}
        </span>
      </div>

      <div>
        <label className="text-[10px] text-gray-500 mb-0.5 block">
          両替金額 ({fromCurrency})
        </label>
        <input
          type="number"
          min="0.01"
          step={fromCurrency === "JPY" ? "1" : "0.01"}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder={fromCurrency === "JPY" ? "100000" : "1000"}
          required
        />
      </div>

      <div className="bg-gray-800/50 rounded px-2 py-1.5 space-y-1 text-[10px]">
        <div className="flex justify-between">
          <span className="text-gray-500">適用レート</span>
          <span className="font-mono text-white">1 USD = ¥{rate.toLocaleString()}</span>
        </div>
        {estimate && (
          <div className="flex justify-between">
            <span className="text-gray-500">概算受取</span>
            <span className="font-mono font-bold text-white">
              {estimate.toCurrency === "JPY" ? "¥" : "$"}{estimate.received.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
      {success && <p className="text-green-400 text-xs">{success}</p>}

      <button
        type="submit"
        disabled={loading || !(numericAmount > 0)}
        className="w-full py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors disabled:opacity-30"
      >
        {loading ? "処理中..." : "両替する"}
      </button>
    </form>
  );
}
