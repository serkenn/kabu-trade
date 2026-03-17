"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

interface RankingUser {
  id: string;
  name: string;
  totalAssetJpy: number;
  totalAssetUsd: number;
  totalPnlJpy: number;
  totalPnlUsd: number;
  pnlRateJpy: number;
  pnlRateUsd: number;
  holdingsCount: number;
  marginCount: number;
}

type SortKey = "totalAssetJpy" | "totalPnlJpy" | "pnlRateJpy";

export default function RankingsPage() {
  const { user } = useAuth();
  const [rankings, setRankings] = useState<RankingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("totalAssetJpy");

  useEffect(() => {
    fetch("/api/account/rankings")
      .then((r) => r.json())
      .then((data) => setRankings(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...rankings].sort((a, b) => {
    if (sortKey === "pnlRateJpy") return b.pnlRateJpy - a.pnlRateJpy;
    return b[sortKey] - a[sortKey];
  });

  const formatJpy = (v: number) => `¥${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const formatRate = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

  const getMedalStyle = (rank: number) => {
    if (rank === 0) return "from-yellow-600/20 to-yellow-900/10 border-yellow-500/40";
    if (rank === 1) return "from-gray-400/20 to-gray-700/10 border-gray-400/40";
    if (rank === 2) return "from-orange-600/20 to-orange-900/10 border-orange-500/40";
    return "";
  };

  const getMedalText = (rank: number) => {
    if (rank === 0) return "text-yellow-400";
    if (rank === 1) return "text-gray-300";
    if (rank === 2) return "text-orange-400";
    return "text-gray-600";
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20 p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 p-3 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl md:text-2xl font-bold">ランキング</h1>
        <div className="flex items-center gap-1.5 md:gap-2">
          <span className="text-xs text-gray-500 hidden md:inline">並び替え:</span>
          {(
            [
              { key: "totalAssetJpy" as SortKey, label: "総資産" },
              { key: "totalPnlJpy" as SortKey, label: "損益額" },
              { key: "pnlRateJpy" as SortKey, label: "損益率" },
            ] as const
          ).map((o) => (
            <button
              key={o.key}
              onClick={() => setSortKey(o.key)}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                sortKey === o.key
                  ? "bg-brand-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top 3 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sorted.slice(0, 3).map((r, i) => (
          <div
            key={r.id}
            className={`card border bg-gradient-to-br ${getMedalStyle(i)} ${r.id === user?.id ? "ring-2 ring-brand-500/50" : ""}`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className={`text-3xl font-black ${getMedalText(i)}`}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg truncate">
                  {r.name}
                  {r.id === user?.id && <span className="text-brand-400 text-xs ml-2">(You)</span>}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-gray-400">総資産</span>
                <span className="text-xl font-bold font-mono">{formatJpy(r.totalAssetJpy)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-gray-400">損益</span>
                <span className={`font-mono font-bold ${r.totalPnlJpy >= 0 ? "text-red-400" : "text-green-400"}`}>
                  {r.totalPnlJpy >= 0 ? "+" : ""}{formatJpy(r.totalPnlJpy)}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-gray-400">損益率</span>
                <span className={`font-mono font-bold ${r.pnlRateJpy >= 0 ? "text-red-400" : "text-green-400"}`}>
                  {formatRate(r.pnlRateJpy)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Full ranking - mobile: cards, desktop: table */}
      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {sorted.map((r, i) => (
          <div
            key={r.id}
            className={`card flex items-center gap-3 ${r.id === user?.id ? "ring-1 ring-brand-500/50" : ""}`}
          >
            <span className={`text-lg font-black w-8 text-center ${getMedalText(i)}`}>{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {r.name}
                {r.id === user?.id && <span className="text-brand-400 text-[10px] ml-1">(You)</span>}
              </p>
              <p className="text-xs text-gray-400 font-mono">{formatJpy(r.totalAssetJpy)}</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-xs font-mono font-bold ${r.totalPnlJpy >= 0 ? "text-red-400" : "text-green-400"}`}>
                {r.totalPnlJpy >= 0 ? "+" : ""}{formatJpy(r.totalPnlJpy)}
              </p>
              <p className={`text-[10px] font-mono ${r.pnlRateJpy >= 0 ? "text-red-400" : "text-green-400"}`}>
                {formatRate(r.pnlRateJpy)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="table-header w-12">#</th>
              <th className="table-header">ユーザー</th>
              <th className="table-header text-right">総資産 (JPY)</th>
              <th className="table-header text-right">損益 (JPY)</th>
              <th className="table-header text-right">損益率</th>
              <th className="table-header text-right">保有銘柄</th>
              <th className="table-header text-right">信用建玉</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr
                key={r.id}
                className={`border-b border-gray-800/50 hover:bg-gray-800/50 ${r.id === user?.id ? "bg-brand-600/10" : ""}`}
              >
                <td className={`table-cell font-bold ${getMedalText(i)}`}>{i + 1}</td>
                <td className="table-cell">
                  <span className="font-medium">
                    {r.name}
                    {r.id === user?.id && <span className="text-brand-400 text-xs ml-1">(You)</span>}
                  </span>
                </td>
                <td className="table-cell text-right font-mono font-bold">
                  {formatJpy(r.totalAssetJpy)}
                </td>
                <td className={`table-cell text-right font-mono font-bold ${r.totalPnlJpy >= 0 ? "text-red-400" : "text-green-400"}`}>
                  {r.totalPnlJpy >= 0 ? "+" : ""}{formatJpy(r.totalPnlJpy)}
                </td>
                <td className={`table-cell text-right font-mono font-bold ${r.pnlRateJpy >= 0 ? "text-red-400" : "text-green-400"}`}>
                  {formatRate(r.pnlRateJpy)}
                </td>
                <td className="table-cell text-right text-gray-400">{r.holdingsCount}</td>
                <td className="table-cell text-right text-gray-400">{r.marginCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
