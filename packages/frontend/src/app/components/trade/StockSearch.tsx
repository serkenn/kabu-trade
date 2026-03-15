"use client";

import { useState, useCallback } from "react";

interface Props {
  market: "JP" | "US";
  onSelect: (symbol: string) => void;
}

export default function StockSearch({ market, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ symbol: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    async (q: string) => {
      if (!q || q.length < 1) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/stocks/search?q=${encodeURIComponent(q)}&market=${market}`
        );
        if (res.ok) {
          setResults(await res.json());
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    },
    [market]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    // Debounce
    const timer = setTimeout(() => search(value), 300);
    return () => clearTimeout(timer);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        className="input"
        placeholder={
          market === "JP"
            ? "銘柄コードまたは企業名で検索..."
            : "Search by ticker or company name..."
        }
      />
      {loading && (
        <div className="absolute right-3 top-2.5">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-500" />
        </div>
      )}
      {results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.symbol}
              onClick={() => {
                onSelect(r.symbol);
                setQuery(r.symbol);
                setResults([]);
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-700 transition-colors flex justify-between items-center"
            >
              <span className="font-mono font-bold text-brand-400">
                {r.symbol}
              </span>
              <span className="text-sm text-gray-400 truncate ml-3">
                {r.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
