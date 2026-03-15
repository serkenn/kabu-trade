"use client";

import { useEffect, useState } from "react";

interface AdminTransaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  currency: string;
  description: string | null;
  createdAt: string;
  user: { name: string; email: string };
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/transactions?page=${page}`)
      .then((r) => r.json())
      .then((data) => {
        setTransactions(data.transactions);
        setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">全取引履歴</h1>
        <p className="text-sm text-gray-400">{total}件</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="table-header">日時</th>
                <th className="table-header">ユーザー</th>
                <th className="table-header">種別</th>
                <th className="table-header">説明</th>
                <th className="table-header text-right">金額</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/50">
                  <td className="table-cell text-xs text-gray-400">
                    {new Date(t.createdAt).toLocaleString("ja-JP")}
                  </td>
                  <td className="table-cell">
                    <p className="text-sm">{t.user.name}</p>
                    <p className="text-xs text-gray-500">{t.user.email}</p>
                  </td>
                  <td className="table-cell">
                    <span className="text-xs bg-gray-800 px-2 py-0.5 rounded">{t.type}</span>
                  </td>
                  <td className="table-cell text-sm text-gray-300 max-w-md truncate">
                    {t.description || "-"}
                  </td>
                  <td className={`table-cell text-right font-mono font-bold ${t.amount >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {t.amount >= 0 ? "+" : ""}{t.currency === "USD" ? "$" : "¥"}{t.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {total > 50 && (
            <div className="flex justify-center gap-2 mt-4 pt-4 border-t border-gray-800">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                前へ
              </button>
              <span className="px-4 py-2 text-sm text-gray-400">
                {page} / {Math.ceil(total / 50)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / 50)}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                次へ
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
