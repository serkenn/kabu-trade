"use client";

import { useEffect, useMemo, useState } from "react";
import FxChart from "@/app/components/trade/FxChart";
import FxForm from "@/app/components/trade/FxForm";
import { useAuth } from "@/hooks/useAuth";
import type { CandleData } from "@/types";

interface FxQuote {
  pair: string;
  rate: number;
  previousClose: number;
  change: number;
  changePercent: number;
  source: string;
}

export default function FxPage() {
  const { user, fetchUser } = useAuth();
  const [days, setDays] = useState(90);
  const [quote, setQuote] = useState<FxQuote | null>(null);
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = async (nextDays: number = days) => {
    setLoading(true);
    try {
      const [quoteRes, candlesRes] = await Promise.all([
        fetch("/api/trade/fx-rate"),
        fetch(`/api/trade/fx-candles?days=${nextDays}`),
      ]);
      const quoteData = await quoteRes.json();
      const candlesData = await candlesRes.json();
      setQuote(quoteData);
      setCandles(candlesData.candles || []);
      setSource(candlesData.source || quoteData.source || "");
    } catch {
      setQuote(null);
      setCandles([]);
      setSource("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(days);
  }, [days]);

  const latest = useMemo(() => candles[candles.length - 1] || null, [candles]);

  return (
    <div className="space-y-4 md:space-y-6 p-3 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">為替取引</h1>
          <p className="text-sm text-gray-500 mt-1">USD/JPY のチャート確認と両替をここで行えます。</p>
        </div>
        <div className="flex gap-2">
          {[30, 90, 180].map((value) => (
            <button
              key={value}
              onClick={() => setDays(value)}
              className={`px-3 py-1.5 rounded text-xs font-bold ${
                days === value ? "bg-brand-600 text-white" : "bg-gray-800 text-gray-400"
              }`}
            >
              {value}日
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="card bg-gradient-to-r from-gray-900 to-gray-800 border-brand-600/20">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm text-gray-400">USD/JPY</p>
                <p className="text-3xl font-mono font-bold mt-1">
                  ¥{quote?.rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "-"}
                </p>
              </div>
              <div className={`text-right font-mono ${quote && quote.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                <p>
                  {quote ? `${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)}` : "-"}
                </p>
                <p className="text-sm">
                  {quote ? `${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%` : "-"}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
              <span>基準: 1 USD</span>
              <span>ソース: {source || "unknown"}</span>
              {source === "fallback" && <span>外部データ未取得のため固定レート表示</span>}
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            {loading ? (
              <div className="h-[420px] flex items-center justify-center text-sm text-gray-500">
                読み込み中...
              </div>
            ) : candles.length === 0 ? (
              <div className="h-[420px] flex items-center justify-center text-sm text-gray-500">
                チャートデータがありません
              </div>
            ) : (
              <FxChart candles={candles} />
            )}
          </div>

          {latest && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="card">
                <p className="text-xs text-gray-500">始値</p>
                <p className="mt-1 font-mono font-bold">¥{latest.open.toFixed(2)}</p>
              </div>
              <div className="card">
                <p className="text-xs text-gray-500">高値</p>
                <p className="mt-1 font-mono font-bold text-red-400">¥{latest.high.toFixed(2)}</p>
              </div>
              <div className="card">
                <p className="text-xs text-gray-500">安値</p>
                <p className="mt-1 font-mono font-bold text-green-400">¥{latest.low.toFixed(2)}</p>
              </div>
              <div className="card">
                <p className="text-xs text-gray-500">終値</p>
                <p className="mt-1 font-mono font-bold">¥{latest.close.toFixed(2)}</p>
              </div>
            </div>
          )}
        </div>

        <div className="card p-0 overflow-hidden h-fit">
          <FxForm
            balanceJpy={user?.balance || 0}
            balanceUsd={user?.balanceUsd || 0}
            onTradeComplete={() => {
              fetchUser();
              load(days);
            }}
          />
        </div>
      </div>
    </div>
  );
}
