"use client";

import { useEffect, useState } from "react";
import type { Order } from "@/types";

export default function HistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trade/orders")
      .then((r) => r.json())
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statusLabel = (status: string) => {
    switch (status) {
      case "FILLED": return "約定";
      case "PENDING": return "待機中";
      case "CANCELLED": return "取消";
      case "PARTIALLY_FILLED": return "一部約定";
      default: return status;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "FILLED": return "text-green-400";
      case "PENDING": return "text-yellow-400";
      case "CANCELLED": return "text-gray-500";
      default: return "text-gray-400";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20 p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">取引履歴</h1>

      {orders.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          取引履歴はありません
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="table-header">日時</th>
                <th className="table-header">銘柄</th>
                <th className="table-header">売買</th>
                <th className="table-header">種別</th>
                <th className="table-header text-right">数量</th>
                <th className="table-header text-right">約定価格</th>
                <th className="table-header text-right">約定額</th>
                <th className="table-header">状態</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/50"
                >
                  <td className="table-cell text-xs text-gray-400">
                    {new Date(o.createdAt).toLocaleString("ja-JP")}
                  </td>
                  <td className="table-cell font-mono font-bold text-brand-400">
                    {o.symbol}
                    <span className="text-xs text-gray-500 ml-1">
                      {o.market === "JP" ? "JP" : "US"}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span
                      className={`font-bold ${
                        o.side === "BUY" ? "text-red-400" : "text-green-400"
                      }`}
                    >
                      {o.side === "BUY" ? "買" : "売"}
                    </span>
                  </td>
                  <td className="table-cell text-xs">
                    <span className="bg-gray-800 px-2 py-0.5 rounded">
                      {o.tradeType === "MARGIN" ? "信用" : "現物"}
                    </span>
                    <span className="text-gray-500 ml-1">
                      {o.type === "MARKET" ? "成行" : "指値"}
                    </span>
                  </td>
                  <td className="table-cell text-right font-mono">
                    {o.filledQty.toLocaleString()}/{o.quantity.toLocaleString()}
                  </td>
                  <td className="table-cell text-right font-mono">
                    {o.filledPrice
                      ? `${o.market === "JP" ? "¥" : "$"}${o.filledPrice.toLocaleString()}`
                      : "-"}
                  </td>
                  <td className="table-cell text-right font-mono">
                    {o.filledPrice && o.filledQty
                      ? `${o.market === "JP" ? "¥" : "$"}${(o.filledPrice * o.filledQty).toLocaleString()}`
                      : "-"}
                  </td>
                  <td className={`table-cell font-bold text-xs ${statusColor(o.status)}`}>
                    {statusLabel(o.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
