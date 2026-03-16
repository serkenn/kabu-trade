"use client";

import { useEffect, useState } from "react";
import type { MarginPosition } from "@/types";

export default function MarginPage() {
  const [positions, setPositions] = useState<MarginPosition[]>([]);
  const [closedPositions, setClosedPositions] = useState<MarginPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState<string | null>(null);
  const [tab, setTab] = useState<"open" | "closed">("open");

  const fetchPositions = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/margin/positions?status=OPEN").then((r) => r.json()),
      fetch("/api/margin/positions?status=CLOSED").then((r) => r.json()),
    ])
      .then(([open, closed]) => {
        setPositions(open);
        setClosedPositions(closed);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPositions();
  }, []);

  const handleClose = async (positionId: string) => {
    if (!confirm("このポジションを決済しますか？")) return;
    setClosing(positionId);
    try {
      const res = await fetch("/api/margin/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId }),
      });
      if (res.ok) {
        const result = await res.json();
        alert(
          `決済完了\n決済価格: ${result.exitPrice.toLocaleString()}\n損益: ${result.pnl >= 0 ? "+" : ""}${result.pnl.toLocaleString()}`
        );
        fetchPositions();
      } else {
        const data = await res.json();
        alert(data.error || "決済に失敗しました");
      }
    } catch {
      alert("決済に失敗しました");
    } finally {
      setClosing(null);
    }
  };

  const displayPositions = tab === "open" ? positions : closedPositions;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">信用取引</h1>

      <div className="flex gap-2">
        <button
          onClick={() => setTab("open")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === "open"
              ? "bg-brand-600 text-white"
              : "bg-gray-800 text-gray-400"
          }`}
        >
          建玉 ({positions.length})
        </button>
        <button
          onClick={() => setTab("closed")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === "closed"
              ? "bg-brand-600 text-white"
              : "bg-gray-800 text-gray-400"
          }`}
        >
          決済済み ({closedPositions.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      ) : displayPositions.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          {tab === "open"
            ? "建玉はありません。取引画面から信用取引を行えます。"
            : "決済済みのポジションはありません。"}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="table-header">銘柄</th>
                <th className="table-header">売買</th>
                <th className="table-header text-right">数量</th>
                <th className="table-header text-right">建値</th>
                {tab === "closed" && (
                  <th className="table-header text-right">決済価格</th>
                )}
                <th className="table-header text-right">証拠金</th>
                <th className="table-header text-right">建日</th>
                {tab === "open" && <th className="table-header" />}
              </tr>
            </thead>
            <tbody>
              {displayPositions.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/50"
                >
                  <td className="table-cell font-mono font-bold text-brand-400">
                    {p.symbol}
                    <span className="text-xs text-gray-500 ml-2">
                      {p.market === "JP" ? "東証" : "US"}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        p.side === "LONG"
                          ? "bg-red-600/20 text-red-400"
                          : "bg-green-600/20 text-green-400"
                      }`}
                    >
                      {p.side === "LONG" ? "買建" : "売建"}
                    </span>
                  </td>
                  <td className="table-cell text-right font-mono">
                    {p.quantity.toLocaleString()}
                  </td>
                  <td className="table-cell text-right font-mono">
                    {p.entryPrice.toLocaleString()}
                  </td>
                  {tab === "closed" && (
                    <td className="table-cell text-right font-mono">
                      {p.exitPrice?.toLocaleString() || "-"}
                    </td>
                  )}
                  <td className="table-cell text-right font-mono text-yellow-400">
                    {p.market === "JP" ? "¥" : "$"}
                    {p.margin.toLocaleString()}
                  </td>
                  <td className="table-cell text-right text-gray-400 text-xs">
                    {new Date(p.createdAt).toLocaleDateString("ja-JP")}
                  </td>
                  {tab === "open" && (
                    <td className="table-cell text-right">
                      <button
                        onClick={() => handleClose(p.id)}
                        disabled={closing === p.id}
                        className="btn-danger text-xs py-1 px-3"
                      >
                        {closing === p.id ? "..." : "決済"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
