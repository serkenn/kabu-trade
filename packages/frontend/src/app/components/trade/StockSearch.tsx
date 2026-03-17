"use client";

import { useState, useCallback } from "react";

interface Props {
  market: "JP" | "US";
  onSelect: (symbol: string, name: string) => void;
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

  const [showDropdown, setShowDropdown] = useState(true);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowDropdown(true);
    const timer = setTimeout(() => search(value), 300);
    return () => clearTimeout(timer);
  };

  const selectItem = (symbol: string, name: string) => {
    onSelect(symbol, name);
    setQuery(symbol);
    setResults([]);
    setShowDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (results.length > 0) {
      selectItem(results[0].symbol, results[0].name);
    } else if (query.length >= 1 && !loading) {
      const isValidCode = /^\d{4}$/.test(query) || /^[A-Z]{1,5}$/.test(query.toUpperCase());
      if (isValidCode) {
        const symbol = market === "JP" ? query : query.toUpperCase();
        selectItem(symbol, query);
      }
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="w-full bg-gray-800 border border-gray-700 rounded text-xs text-white placeholder-gray-500 pl-7 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder={market === "JP" ? "銘柄コード / 企業名" : "Ticker / Company"}
        />
        {loading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-3 w-3 border-b border-brand-500" />
          </div>
        )}
      </div>
      {showDropdown && (results.length > 0 || (query.length >= 1 && !loading)) && (
        <div className="absolute z-50 w-80 mt-1 bg-gray-800 border border-gray-700 rounded shadow-xl max-h-60 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.symbol}
              onClick={() => selectItem(r.symbol, r.name)}
              className="w-full text-left px-3 py-1.5 hover:bg-gray-700 transition-colors flex justify-between items-center text-xs"
            >
              <span className="font-mono font-bold text-brand-400">{r.symbol}</span>
              <span className="text-gray-400 truncate ml-3">{r.name}</span>
            </button>
          ))}
          {results.length === 0 && query.length >= 1 && !loading && (
            <div className="px-3 py-2 text-xs text-gray-500">
              {/^\d{4}$/.test(query) || /^[A-Z]{1,5}$/.test(query.toUpperCase()) ? (
                <button
                  onClick={() => selectItem(market === "JP" ? query : query.toUpperCase(), query)}
                  className="w-full text-left hover:bg-gray-700 px-2 py-1 rounded transition-colors"
                >
                  <span className="font-mono font-bold text-brand-400">{market === "JP" ? query : query.toUpperCase()}</span>
                  <span className="text-gray-400 ml-2">をそのまま使用</span>
                </button>
              ) : (
                "該当銘柄なし"
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
