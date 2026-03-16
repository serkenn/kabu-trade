"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { Holding, Transaction } from "@/types";

interface AccountData {
  holdings: Holding[];
  totalMarginUsed: number;
  recentTransactions: Transaction[];
}

interface HoldingWithPrice extends Holding {
  currentPrice?: number;
  marketValue?: number;
  pnl?: number;
  pnlPercent?: number;
}

export default function PortfolioPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [holdings, setHoldings] = useState<HoldingWithPrice[]>([]);
  const [priceLoading, setPriceLoading] = useState(false);

  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fetch current prices for all holdings
  useEffect(() => {
    if (!data?.holdings.length) {
      setHoldings([]);
      return;
    }

    setPriceLoading(true);
    const fetchPrices = async () => {
      const results: HoldingWithPrice[] = await Promise.all(
        data.holdings.map(async (h) => {
          try {
            const res = await fetch(`/api/stocks/quote?symbol=${h.symbol}&market=${h.market}`);
            if (res.ok) {
              const q = await res.json();
              const currentPrice = q.price;
              const marketValue = currentPrice * h.quantity;
              const costBasis = h.avgCost * h.quantity;
              const pnl = marketValue - costBasis;
              const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
              return { ...h, currentPrice, marketValue, pnl, pnlPercent };
            }
          } catch {
            // ignore
          }
          return { ...h, marketValue: h.avgCost * h.quantity };
        })
      );
      setHoldings(results);
      setPriceLoading(false);
    };

    fetchPrices();
  }, [data]);

  if (loading) {
    return (
      <div className="flex justify-center py-20 p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  // Calculate totals
  const cashJpy = user?.balance || 0;
  const cashUsd = user?.balanceUsd || 0;
  const holdingsValueJpy = holdings
    .filter((h) => h.market === "JP")
    .reduce((sum, h) => sum + (h.marketValue || 0), 0);
  const holdingsValueUsd = holdings
    .filter((h) => h.market === "US")
    .reduce((sum, h) => sum + (h.marketValue || 0), 0);
  const totalPnlJpy = holdings
    .filter((h) => h.market === "JP")
    .reduce((sum, h) => sum + (h.pnl || 0), 0);
  const totalPnlUsd = holdings
    .filter((h) => h.market === "US")
    .reduce((sum, h) => sum + (h.pnl || 0), 0);
  const totalAssetJpy = cashJpy + holdingsValueJpy;
  const totalAssetUsd = cashUsd + holdingsValueUsd;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">ポートフォリオ</h1>

      {/* 総資産評価額 */}
      <div className="card bg-gradient-to-r from-gray-900 to-gray-800 border-brand-600/30">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-400">総資産評価額</p>
          {priceLoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b border-brand-500" />
          )}
        </div>
        <div className="flex items-baseline gap-6">
          <div>
            <p className="text-3xl font-bold font-mono">
              ¥{totalAssetJpy.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            {totalPnlJpy !== 0 && (
              <p className={`text-sm font-mono mt-1 ${totalPnlJpy >= 0 ? "text-red-400" : "text-green-400"}`}>
                {totalPnlJpy >= 0 ? "+" : ""}¥{totalPnlJpy.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                <span className="text-gray-500 ml-1">(含み損益)</span>
              </p>
            )}
          </div>
          {(totalAssetUsd > 0 || cashUsd > 0) && (
            <div className="border-l border-gray-700 pl-6">
              <p className="text-3xl font-bold font-mono">
                ${totalAssetUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              {totalPnlUsd !== 0 && (
                <p className={`text-sm font-mono mt-1 ${totalPnlUsd >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {totalPnlUsd >= 0 ? "+" : ""}${totalPnlUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="text-gray-500 ml-1">(含み損益)</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 資産内訳 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-400">現金残高 (JPY)</p>
          <p className="text-2xl font-bold mt-1 font-mono">
            ¥{cashJpy.toLocaleString()}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-400">現金残高 (USD)</p>
          <p className="text-2xl font-bold mt-1 font-mono">
            ${cashUsd.toLocaleString()}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-400">株式評価額</p>
          <p className="text-2xl font-bold mt-1 font-mono">
            ¥{holdingsValueJpy.toLocaleString()}
          </p>
          {holdingsValueUsd > 0 && (
            <p className="text-sm text-gray-400 font-mono mt-0.5">
              ${holdingsValueUsd.toLocaleString()}
            </p>
          )}
        </div>
        <div className="card">
          <p className="text-sm text-gray-400">信用使用額</p>
          <p className="text-2xl font-bold mt-1 text-yellow-400 font-mono">
            ¥{(data?.totalMarginUsed || 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* 保有銘柄 */}
      <div className="card">
        <h2 className="font-bold text-lg mb-4">保有銘柄</h2>
        {holdings.length === 0 ? (
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
                  <th className="table-header text-right">現在値</th>
                  <th className="table-header text-right">評価額</th>
                  <th className="table-header text-right">損益</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => {
                  const currency = h.market === "JP" ? "¥" : "$";
                  const isJP = h.market === "JP";
                  const pnlColor = h.pnl !== undefined
                    ? (isJP
                        ? (h.pnl >= 0 ? "text-red-400" : "text-green-400")
                        : (h.pnl >= 0 ? "text-green-400" : "text-red-400"))
                    : "text-gray-400";
                  return (
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
                        {currency}{h.avgCost.toLocaleString()}
                      </td>
                      <td className="table-cell text-right font-mono">
                        {h.currentPrice !== undefined
                          ? `${currency}${h.currentPrice.toLocaleString()}`
                          : <span className="text-gray-600">-</span>
                        }
                      </td>
                      <td className="table-cell text-right font-mono font-bold">
                        {currency}{(h.marketValue || 0).toLocaleString()}
                      </td>
                      <td className={`table-cell text-right font-mono font-bold ${pnlColor}`}>
                        {h.pnl !== undefined ? (
                          <>
                            {h.pnl >= 0 ? "+" : ""}{currency}{h.pnl.toLocaleString(undefined, { maximumFractionDigits: isJP ? 0 : 2 })}
                            <br />
                            <span className="text-xs">
                              ({h.pnlPercent !== undefined ? `${h.pnlPercent >= 0 ? "+" : ""}${h.pnlPercent.toFixed(2)}%` : ""})
                            </span>
                          </>
                        ) : "-"}
                      </td>
                    </tr>
                  );
                })}
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
