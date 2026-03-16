"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface RankingUser {
  id: string;
  name: string;
  email: string;
  role: string;
  totalAssetJpy: number;
  totalAssetUsd: number;
  totalPnlJpy: number;
  totalPnlUsd: number;
  pnlRateJpy: number;
  pnlRateUsd: number;
  holdingsCount: number;
  marginCount: number;
}

type SortKey = "totalAssetJpy" | "totalPnlJpy" | "pnlRateJpy" | "totalAssetUsd" | "totalPnlUsd" | "pnlRateUsd";

export default function RankingsPage() {
  const [rankings, setRankings] = useState<RankingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("totalAssetJpy");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/admin/rankings")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setRankings(data.rankings))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...rankings].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    // 損益率は絶対値が大きい方が上
    if (sortKey.startsWith("pnlRate")) return Math.abs(vb) > Math.abs(va) ? 1 : -1;
    return vb - va;
  });

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "totalAssetJpy", label: "総資産 (JPY)" },
    { key: "totalPnlJpy", label: "損益額 (JPY)" },
    { key: "pnlRateJpy", label: "損益率 (JPY)" },
    { key: "totalAssetUsd", label: "総資産 (USD)" },
    { key: "totalPnlUsd", label: "損益額 (USD)" },
    { key: "pnlRateUsd", label: "損益率 (USD)" },
  ];

  const getMedalColor = (rank: number) => {
    if (rank === 0) return "text-yellow-400";
    if (rank === 1) return "text-gray-300";
    if (rank === 2) return "text-orange-400";
    return "text-gray-600";
  };

  const formatJpy = (v: number) => `¥${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const formatUsd = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatRate = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ランキング</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">ソート:</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="input text-sm w-auto"
          >
            {sortOptions.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      ) : error ? (
        <div className="card text-center py-12 text-red-400">{error}</div>
      ) : (
        <>
          {/* Top 3 cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sorted.slice(0, 3).map((u, i) => (
              <Link
                key={u.id}
                href={`/users/${u.id}`}
                className={`card border-2 hover:border-purple-500/50 transition-colors ${
                  i === 0 ? "border-yellow-500/30" : i === 1 ? "border-gray-400/30" : "border-orange-500/30"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-2xl font-bold ${getMedalColor(i)}`}>
                    #{i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{u.name}</p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                  {u.role === "ADMIN" && (
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-600/20 text-purple-400">
                      ADMIN
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-400">総資産</p>
                    <p className="text-xl font-bold font-mono">{formatJpy(u.totalAssetJpy)}</p>
                    {u.totalAssetUsd > 0 && (
                      <p className="text-sm text-gray-400 font-mono">{formatUsd(u.totalAssetUsd)}</p>
                    )}
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <p className="text-xs text-gray-400">損益</p>
                      <p className={`font-mono font-bold ${u.totalPnlJpy >= 0 ? "text-red-400" : "text-green-400"}`}>
                        {u.totalPnlJpy >= 0 ? "+" : ""}{formatJpy(u.totalPnlJpy)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">損益率</p>
                      <p className={`font-mono font-bold ${u.pnlRateJpy >= 0 ? "text-red-400" : "text-green-400"}`}>
                        {formatRate(u.pnlRateJpy)}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Full table */}
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="table-header w-12">#</th>
                  <th className="table-header">ユーザー</th>
                  <th className="table-header text-right">総資産 (JPY)</th>
                  <th className="table-header text-right">損益 (JPY)</th>
                  <th className="table-header text-right">損益率</th>
                  <th className="table-header text-right">総資産 (USD)</th>
                  <th className="table-header text-right">損益 (USD)</th>
                  <th className="table-header text-right">保有</th>
                  <th className="table-header text-right">信用</th>
                  <th className="table-header" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((u, i) => (
                  <tr
                    key={u.id}
                    className="border-b border-gray-800/50 hover:bg-gray-800/50"
                  >
                    <td className={`table-cell font-bold ${getMedalColor(i)}`}>
                      {i + 1}
                    </td>
                    <td className="table-cell">
                      <p className="font-medium">{u.name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </td>
                    <td className="table-cell text-right font-mono font-bold">
                      {formatJpy(u.totalAssetJpy)}
                    </td>
                    <td className={`table-cell text-right font-mono font-bold ${u.totalPnlJpy >= 0 ? "text-red-400" : "text-green-400"}`}>
                      {u.totalPnlJpy >= 0 ? "+" : ""}{formatJpy(u.totalPnlJpy)}
                    </td>
                    <td className={`table-cell text-right font-mono font-bold ${u.pnlRateJpy >= 0 ? "text-red-400" : "text-green-400"}`}>
                      {formatRate(u.pnlRateJpy)}
                    </td>
                    <td className="table-cell text-right font-mono">
                      {u.totalAssetUsd > 0 ? formatUsd(u.totalAssetUsd) : "-"}
                    </td>
                    <td className={`table-cell text-right font-mono ${u.totalPnlUsd >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {u.totalPnlUsd !== 0 ? `${u.totalPnlUsd >= 0 ? "+" : ""}${formatUsd(u.totalPnlUsd)}` : "-"}
                    </td>
                    <td className="table-cell text-right text-gray-400">{u.holdingsCount}</td>
                    <td className="table-cell text-right text-gray-400">{u.marginCount}</td>
                    <td className="table-cell">
                      <Link
                        href={`/users/${u.id}`}
                        className="text-brand-400 hover:text-brand-300 text-sm"
                      >
                        詳細
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
