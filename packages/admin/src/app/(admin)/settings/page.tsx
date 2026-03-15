"use client";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">システム設定</h1>

      <div className="card">
        <h2 className="font-bold text-lg mb-4">API接続状態</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-800/50">
            <span className="text-gray-300">J-Quants API (日本株)</span>
            <span className={`text-xs px-2 py-1 rounded ${process.env.NEXT_PUBLIC_APP_URL ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"}`}>
              設定済み
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-800/50">
            <span className="text-gray-300">Finnhub API (米国株)</span>
            <span className="text-xs px-2 py-1 rounded bg-yellow-600/20 text-yellow-400">
              .envで設定
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-800/50">
            <span className="text-gray-300">evex-accounts</span>
            <span className="text-xs px-2 py-1 rounded bg-yellow-600/20 text-yellow-400">
              .envで設定
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-gray-300">Cloudflare Tunnel</span>
            <span className="text-xs px-2 py-1 rounded bg-yellow-600/20 text-yellow-400">
              docker-composeで管理
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-bold text-lg mb-4">デフォルト設定</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400">初期残高 (JPY)</p>
            <p className="font-mono text-lg">¥10,000,000</p>
          </div>
          <div>
            <p className="text-gray-400">初期残高 (USD)</p>
            <p className="font-mono text-lg">$0</p>
          </div>
          <div>
            <p className="text-gray-400">デフォルト信用倍率</p>
            <p className="font-mono text-lg">3.0倍</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          これらの値はprisma/schema.prismaで変更できます。
        </p>
      </div>
    </div>
  );
}
