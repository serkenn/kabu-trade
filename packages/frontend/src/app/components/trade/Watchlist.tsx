"use client";

import { useState, useEffect, useCallback } from "react";

interface WatchlistItem {
  id: string;
  symbol: string;
  market: "JP" | "US";
  name: string;
}

interface Props {
  currentSymbol: string;
  currentMarket: "JP" | "US";
  currentName?: string;
  onSelect: (symbol: string, market: "JP" | "US") => void;
}

export default function Watchlist({ currentSymbol, currentMarket, currentName, onSelect }: Props) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      if (res.ok) {
        setItems(await res.json());
      } else {
        console.error("Watchlist fetch failed:", res.status);
      }
    } catch (e) {
      console.error("Watchlist fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const isInList = items.some((i) => i.symbol === currentSymbol && i.market === currentMarket);

  const addCurrent = async () => {
    if (!currentSymbol || adding) return;
    setAdding(true);
    setError(null);
    try {
      const body = { symbol: currentSymbol, market: currentMarket, name: currentName || "" };
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchList();
      } else {
        const err = await res.text().catch(() => "");
        console.error("Watchlist add failed:", res.status, err);
        setError(`追加失敗 (${res.status})`);
      }
    } catch (e) {
      console.error("Watchlist add error:", e);
      setError("追加失敗");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (symbol: string, market: string) => {
    try {
      const res = await fetch(`/api/watchlist/${encodeURIComponent(symbol)}/${encodeURIComponent(market)}`, { method: "DELETE" });
      if (res.ok) fetchList();
    } catch {
      // ignore
    }
  };

  return (
    <div className="border-t border-gray-800">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">お気に入り</span>
        {currentSymbol && !isInList && (
          <button
            onClick={addCurrent}
            disabled={adding}
            className="text-[10px] text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-50"
          >
            {adding ? "追加中..." : "+ 追加"}
          </button>
        )}
      </div>

      {error && (
        <div className="px-3 py-1 text-[10px] text-red-400">{error}</div>
      )}

      <div className="max-h-60 overflow-y-auto">
        {loading ? (
          <div className="px-3 py-4 text-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b border-brand-500 mx-auto" />
          </div>
        ) : items.length === 0 ? (
          <p className="px-3 py-4 text-xs text-gray-600 text-center">
            銘柄を検索して追加
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between px-3 py-1.5 text-xs cursor-pointer transition-colors hover:bg-gray-800 ${
                item.symbol === currentSymbol && item.market === currentMarket
                  ? "bg-gray-800/50 text-white"
                  : "text-gray-400"
              }`}
            >
              <button
                className="flex-1 text-left flex items-center gap-2 min-w-0"
                onClick={() => onSelect(item.symbol, item.market)}
              >
                <span className={`text-[9px] px-1 rounded ${item.market === "JP" ? "bg-blue-900/50 text-blue-400" : "bg-green-900/50 text-green-400"}`}>
                  {item.market}
                </span>
                <span className="font-mono font-bold text-white">{item.symbol}</span>
                <span className="text-gray-500 truncate text-[10px]">{item.name}</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  remove(item.symbol, item.market);
                }}
                className="text-gray-600 hover:text-red-400 transition-colors ml-1 shrink-0"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
