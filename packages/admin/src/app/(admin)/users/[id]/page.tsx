"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface HoldingDetail {
  id: string;
  symbol: string;
  market: string;
  quantity: number;
  avgCost: number;
  currentPrice?: number | null;
  marketValue?: number;
  pnl?: number;
  pnlPercent?: number;
}

interface MarginDetail {
  id: string;
  symbol: string;
  market: string;
  side: string;
  quantity: number;
  entryPrice: number;
  margin: number;
  currentPrice?: number | null;
  pnl?: number;
}

interface UserDetail {
  id: string;
  email: string;
  name: string;
  role: string;
  balance: number;
  balanceUsd: number;
  marginRate: number;
  isActive: boolean;
  authProvider?: string;
  externalId?: string | null;
  discordId?: string | null;
  discordRoles?: string[];
  holdings: HoldingDetail[];
  marginPositions: MarginDetail[];
  orders: Array<{
    id: string;
    symbol: string;
    side: string;
    tradeType: string;
    quantity: number;
    filledPrice: number | null;
    status: string;
    createdAt: string;
  }>;
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    currency: string;
    description: string | null;
    createdAt: string;
  }>;
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    balance: 0,
    balanceUsd: 0,
    marginRate: 3.0,
    isActive: true,
    role: "USER",
  });

  useEffect(() => {
    // 基本情報 + ポートフォリオ(現在価格付き)を並行取得
    Promise.all([
      fetch(`/api/admin/users/${params.id}`).then((r) => r.json()),
      fetch(`/api/admin/users/${params.id}/portfolio`).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([data, portfolio]) => {
      // ポートフォリオが取得できた場合、保有銘柄と信用ポジションを上書き
      if (portfolio) {
        data.holdings = portfolio.holdings;
        data.marginPositions = portfolio.marginPositions;
      }
      setUser(data);
      setForm({
        balance: data.balance,
        balanceUsd: data.balanceUsd,
        marginRate: data.marginRate,
        isActive: data.isActive,
        role: data.role,
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [params.id]);

  const handleSave = async () => {
    const res = await fetch(`/api/admin/users/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const updated = await res.json();
      setUser((prev) => (prev ? { ...prev, ...updated } : prev));
      setEditing(false);
      alert("更新しました");
    } else {
      alert("更新に失敗しました");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (!user) return <p>ユーザーが見つかりません</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white">
          ← 戻る
        </button>
        <h1 className="text-2xl font-bold">{user.name}</h1>
        <span className="text-sm text-gray-500">{user.email}</span>
      </div>

      {/* ユーザー情報編集 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">アカウント情報</h2>
          <button
            onClick={() => (editing ? handleSave() : setEditing(true))}
            className={editing ? "btn-primary text-sm" : "btn-secondary text-sm"}
          >
            {editing ? "保存" : "編集"}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="label">残高 (JPY)</label>
            {editing ? (
              <input
                type="number"
                value={form.balance}
                onChange={(e) =>
                  setForm({ ...form, balance: parseFloat(e.target.value) })
                }
                className="input"
              />
            ) : (
              <p className="text-xl font-mono">¥{user.balance.toLocaleString()}</p>
            )}
          </div>
          <div>
            <label className="label">残高 (USD)</label>
            {editing ? (
              <input
                type="number"
                value={form.balanceUsd}
                onChange={(e) =>
                  setForm({ ...form, balanceUsd: parseFloat(e.target.value) })
                }
                className="input"
              />
            ) : (
              <p className="text-xl font-mono">${user.balanceUsd.toLocaleString()}</p>
            )}
          </div>
          <div>
            <label className="label">信用倍率</label>
            {editing ? (
              <input
                type="number"
                step="0.1"
                value={form.marginRate}
                onChange={(e) =>
                  setForm({ ...form, marginRate: parseFloat(e.target.value) })
                }
                className="input"
              />
            ) : (
              <p className="text-xl font-mono">{user.marginRate}倍</p>
            )}
          </div>
          <div>
            <label className="label">ロール</label>
            {editing ? (
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="input"
              >
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            ) : (
              <p className={`font-bold ${user.role === "ADMIN" ? "text-purple-400" : ""}`}>
                {user.role}
              </p>
            )}
          </div>
          <div>
            <label className="label">状態</label>
            {editing ? (
              <select
                value={form.isActive ? "true" : "false"}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.value === "true" })
                }
                className="input"
              >
                <option value="true">有効</option>
                <option value="false">無効</option>
              </select>
            ) : (
              <p className={user.isActive ? "text-green-400" : "text-red-400"}>
                {user.isActive ? "有効" : "無効"}
              </p>
            )}
          </div>
        </div>
        {editing && (
          <button
            onClick={() => setEditing(false)}
            className="btn-secondary text-sm mt-4"
          >
            キャンセル
          </button>
        )}
      </div>

      {/* 認証情報 */}
      <div className="card">
        <h2 className="font-bold text-lg mb-4">認証情報</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="label">認証タイプ</label>
            <p className="flex items-center gap-2">
              {user.authProvider === "evex" || user.externalId ? (
                <span className="text-sm px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 font-bold">
                  evex-accounts
                </span>
              ) : (
                <span className="text-sm px-2 py-0.5 rounded bg-gray-700 text-gray-300 font-bold">
                  ローカル認証
                </span>
              )}
            </p>
          </div>
          {(user.authProvider === "evex" || user.externalId) && (
            <>
              <div>
                <label className="label">External ID</label>
                <p className="text-xs font-mono text-gray-400 break-all">{user.externalId || "-"}</p>
              </div>
              <div>
                <label className="label">Discord ID</label>
                <p className="text-sm font-mono text-gray-300">{user.discordId || "-"}</p>
              </div>
              <div>
                <label className="label">Discord Roles</label>
                {user.discordRoles && user.discordRoles.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {user.discordRoles.map((role, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded bg-indigo-600/20 text-indigo-400">
                        {role}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">なし</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 保有銘柄 */}
      <div className="card">
        <h2 className="font-bold text-lg mb-4">保有銘柄 ({user.holdings.length})</h2>
        {user.holdings.length > 0 ? (
          <>
            {/* サマリー */}
            {(() => {
              const totalPnl = user.holdings.reduce((s, h) => s + (h.pnl || 0), 0);
              const totalValue = user.holdings.reduce((s, h) => s + (h.marketValue || h.avgCost * h.quantity), 0);
              return (
                <div className="flex gap-6 mb-4 text-sm">
                  <div>
                    <span className="text-gray-400">時価評価合計: </span>
                    <span className="font-mono font-bold">¥{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">含み損益合計: </span>
                    <span className={`font-mono font-bold ${totalPnl >= 0 ? "text-red-400" : "text-green-400"}`}>
                      {totalPnl >= 0 ? "+" : ""}¥{totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              );
            })()}
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="table-header">銘柄</th>
                  <th className="table-header">市場</th>
                  <th className="table-header text-right">数量</th>
                  <th className="table-header text-right">平均取得単価</th>
                  <th className="table-header text-right">現在値</th>
                  <th className="table-header text-right">時価評価額</th>
                  <th className="table-header text-right">損益</th>
                  <th className="table-header text-right">損益率</th>
                </tr>
              </thead>
              <tbody>
                {user.holdings.map((h) => {
                  const c = h.market === "JP" ? "¥" : "$";
                  const pnlColor = h.pnl !== undefined && h.pnl !== 0
                    ? (h.market === "JP"
                        ? (h.pnl >= 0 ? "text-red-400" : "text-green-400")
                        : (h.pnl >= 0 ? "text-green-400" : "text-red-400"))
                    : "text-gray-500";
                  return (
                    <tr key={h.id} className="border-b border-gray-800/50 hover:bg-gray-800/50">
                      <td className="table-cell font-mono font-bold text-brand-400">{h.symbol}</td>
                      <td className="table-cell">
                        <span className="text-xs bg-gray-800 px-2 py-0.5 rounded">
                          {h.market === "JP" ? "東証" : "US"}
                        </span>
                      </td>
                      <td className="table-cell text-right font-mono">{h.quantity.toLocaleString()}</td>
                      <td className="table-cell text-right font-mono">{c}{h.avgCost.toLocaleString()}</td>
                      <td className="table-cell text-right font-mono">
                        {h.currentPrice != null ? `${c}${h.currentPrice.toLocaleString()}` : <span className="text-gray-600">-</span>}
                      </td>
                      <td className="table-cell text-right font-mono font-bold">
                        {c}{(h.marketValue || h.avgCost * h.quantity).toLocaleString()}
                      </td>
                      <td className={`table-cell text-right font-mono font-bold ${pnlColor}`}>
                        {h.pnl !== undefined ? `${h.pnl >= 0 ? "+" : ""}${c}${h.pnl.toLocaleString(undefined, { maximumFractionDigits: h.market === "JP" ? 0 : 2 })}` : "-"}
                      </td>
                      <td className={`table-cell text-right font-mono ${pnlColor}`}>
                        {h.pnlPercent !== undefined ? `${h.pnlPercent >= 0 ? "+" : ""}${h.pnlPercent.toFixed(2)}%` : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        ) : (
          <p className="text-gray-500 text-center py-4">保有銘柄なし</p>
        )}
      </div>

      {/* 信用ポジション */}
      {user.marginPositions.length > 0 && (
        <div className="card">
          <h2 className="font-bold text-lg mb-4">
            信用建玉 ({user.marginPositions.length})
          </h2>
          {(() => {
            const totalMarginPnl = user.marginPositions.reduce((s, p) => s + (p.pnl || 0), 0);
            return totalMarginPnl !== 0 && (
              <div className="mb-4 text-sm">
                <span className="text-gray-400">含み損益合計: </span>
                <span className={`font-mono font-bold ${totalMarginPnl >= 0 ? "text-red-400" : "text-green-400"}`}>
                  {totalMarginPnl >= 0 ? "+" : ""}¥{totalMarginPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            );
          })()}
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="table-header">銘柄</th>
                <th className="table-header">売買</th>
                <th className="table-header text-right">数量</th>
                <th className="table-header text-right">建値</th>
                <th className="table-header text-right">現在値</th>
                <th className="table-header text-right">証拠金</th>
                <th className="table-header text-right">含み損益</th>
              </tr>
            </thead>
            <tbody>
              {user.marginPositions.map((p) => {
                const pnlColor = p.pnl && p.pnl !== 0
                  ? (p.pnl >= 0 ? "text-red-400" : "text-green-400")
                  : "text-gray-500";
                return (
                  <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/50">
                    <td className="table-cell font-mono text-brand-400">{p.symbol}</td>
                    <td className="table-cell">
                      <span className={p.side === "LONG" ? "text-red-400" : "text-green-400"}>
                        {p.side === "LONG" ? "買建" : "売建"}
                      </span>
                    </td>
                    <td className="table-cell text-right font-mono">{p.quantity}</td>
                    <td className="table-cell text-right font-mono">{p.entryPrice.toLocaleString()}</td>
                    <td className="table-cell text-right font-mono">
                      {p.currentPrice != null ? p.currentPrice.toLocaleString() : <span className="text-gray-600">-</span>}
                    </td>
                    <td className="table-cell text-right font-mono text-yellow-400">
                      ¥{p.margin.toLocaleString()}
                    </td>
                    <td className={`table-cell text-right font-mono font-bold ${pnlColor}`}>
                      {p.pnl !== undefined ? `${p.pnl >= 0 ? "+" : ""}¥${p.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 最近の注文 */}
      <div className="card">
        <h2 className="font-bold text-lg mb-4">最近の注文</h2>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {user.orders.map((o) => (
            <div
              key={o.id}
              className="flex items-center justify-between py-2 border-b border-gray-800/50 text-sm"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-brand-400">{o.symbol}</span>
                <span className={o.side === "BUY" ? "text-red-400" : "text-green-400"}>
                  {o.side === "BUY" ? "買" : "売"}
                </span>
                <span className="text-gray-500">{o.tradeType === "MARGIN" ? "信用" : "現物"}</span>
                <span className="text-gray-400">{o.quantity}株</span>
              </div>
              <div className="flex items-center gap-3">
                {o.filledPrice && (
                  <span className="font-mono">@{o.filledPrice.toLocaleString()}</span>
                )}
                <span className={o.status === "FILLED" ? "text-green-400" : "text-yellow-400"}>
                  {o.status}
                </span>
                <span className="text-gray-500 text-xs">
                  {new Date(o.createdAt).toLocaleString("ja-JP")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 取引履歴 */}
      <div className="card">
        <h2 className="font-bold text-lg mb-4">取引履歴</h2>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {user.transactions.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between py-2 border-b border-gray-800/50 text-sm"
            >
              <div>
                <p>{t.description || t.type}</p>
                <p className="text-xs text-gray-500">
                  {new Date(t.createdAt).toLocaleString("ja-JP")}
                </p>
              </div>
              <p className={`font-mono font-bold ${t.amount >= 0 ? "text-green-400" : "text-red-400"}`}>
                {t.amount >= 0 ? "+" : ""}{t.currency === "USD" ? "$" : "¥"}{t.amount.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
