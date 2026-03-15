"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  balance: number;
  balanceUsd: number;
  marginRate: number;
  isActive: boolean;
  createdAt: string;
  _count: { orders: number; holdings: number; marginPositions: number };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchUsers = () => {
    setLoading(true);
    fetch(`/api/admin/users?page=${page}&search=${encodeURIComponent(search)}`)
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users);
        setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, [page, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ユーザー管理</h1>
        <p className="text-sm text-gray-400">{total}人のユーザー</p>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="input max-w-md"
        placeholder="名前またはメールで検索..."
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="table-header">ユーザー</th>
                <th className="table-header">ロール</th>
                <th className="table-header text-right">残高 (JPY)</th>
                <th className="table-header text-right">残高 (USD)</th>
                <th className="table-header text-right">注文数</th>
                <th className="table-header text-right">保有銘柄</th>
                <th className="table-header">状態</th>
                <th className="table-header">登録日</th>
                <th className="table-header" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/50"
                >
                  <td className="table-cell">
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </td>
                  <td className="table-cell">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        u.role === "ADMIN"
                          ? "bg-purple-600/20 text-purple-400"
                          : "bg-gray-700 text-gray-300"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="table-cell text-right font-mono">
                    ¥{u.balance.toLocaleString()}
                  </td>
                  <td className="table-cell text-right font-mono">
                    ${u.balanceUsd.toLocaleString()}
                  </td>
                  <td className="table-cell text-right">{u._count.orders}</td>
                  <td className="table-cell text-right">{u._count.holdings}</td>
                  <td className="table-cell">
                    <span
                      className={`text-xs ${
                        u.isActive ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {u.isActive ? "有効" : "無効"}
                    </span>
                  </td>
                  <td className="table-cell text-xs text-gray-400">
                    {new Date(u.createdAt).toLocaleDateString("ja-JP")}
                  </td>
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

          {total > 20 && (
            <div className="flex justify-center gap-2 mt-4 pt-4 border-t border-gray-800">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                前へ
              </button>
              <span className="px-4 py-2 text-sm text-gray-400">
                {page} / {Math.ceil(total / 20)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / 20)}
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
