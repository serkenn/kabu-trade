"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { Holding, Transaction } from "@/types";

interface AccountData {
  holdings: Holding[];
  totalMarginUsed: number;
  recentTransactions: Transaction[];
}

export default function PortfolioPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20 p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">ポートフォリオ</h1>

      {/* 資産サマリー */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-400">現金残高 (JPY)</p>
          <p className="text-2xl font-bold mt-1">
            ¥{(user?.balance || 0).toLocaleString()}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-400">現金残高 (USD)</p>
          <p className="text-2xl font-bold mt-1">
            ${(user?.balanceUsd || 0).toLocaleString()}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-400">保有銘柄数</p>
          <p className="text-2xl font-bold mt-1">
            {data?.holdings.length || 0}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-400">信用使用額</p>
          <p className="text-2xl font-bold mt-1 text-yellow-400">
            ¥{(data?.totalMarginUsed || 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* 保有銘柄 */}
      <div className="card">
        <h2 className="font-bold text-lg mb-4">保有銘柄</h2>
        {data?.holdings.length === 0 ? (
          <p className="text-gray-500 text-center py-8">保有銘柄はありません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="table-header">銘柄</th>
                  <th className="table-header">市場</th>
                  <th className="table-header text-right">数量</th>
                  <th className="table-header text-right">平均取得単価</th>
                  <th className="table-header text-right">評価額</th>
                </tr>
              </thead>
              <tbody>
                {data?.holdings.map((h) => (
                  <tr
                    key={h.id}
                    className="border-b border-gray-800/50 hover:bg-gray-800/50"
                  >
                    <td className="table-cell font-mono font-bold text-brand-400">
                      {h.symbol}
                    </td>
                    <td className="table-cell">
                      <span className="text-xs bg-gray-800 px-2 py-0.5 rounded">
                        {h.market === "JP" ? "東証" : "US"}
                      </span>
                    </td>
                    <td className="table-cell text-right font-mono">
                      {h.quantity.toLocaleString()}
                    </td>
                    <td className="table-cell text-right font-mono">
                      {h.market === "JP" ? "¥" : "$"}
                      {h.avgCost.toLocaleString()}
                    </td>
                    <td className="table-cell text-right font-mono">
                      {h.market === "JP" ? "¥" : "$"}
                      {(h.avgCost * h.quantity).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 最近の取引 */}
      <div className="card">
        <h2 className="font-bold text-lg mb-4">最近の取引</h2>
        {data?.recentTransactions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">取引履歴はありません</p>
        ) : (
          <div className="space-y-2">
            {data?.recentTransactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between py-2 border-b border-gray-800/50"
              >
                <div>
                  <p className="text-sm">{t.description || t.type}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(t.createdAt).toLocaleString("ja-JP")}
                  </p>
                </div>
                <p
                  className={`font-mono font-bold ${
                    t.amount >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {t.amount >= 0 ? "+" : ""}
                  {t.currency === "USD" ? "$" : "¥"}
                  {t.amount.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
