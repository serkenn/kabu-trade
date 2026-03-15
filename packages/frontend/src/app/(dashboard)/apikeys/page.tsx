"use client";

import { useEffect, useState } from "react";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const PERMISSION_OPTIONS = [
  { value: "read", label: "読み取り", desc: "株価取得・残高確認・履歴閲覧" },
  { value: "trade", label: "現物取引", desc: "現物の買い/売り注文" },
  { value: "margin", label: "信用取引", desc: "信用買建・売建・決済" },
];

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<string[]>(["read", "trade"]);
  const [expiresInDays, setExpiresInDays] = useState<number | "">("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = () => {
    setLoading(true);
    fetch("/api/apikeys")
      .then((r) => r.json())
      .then((data) => setKeys(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/apikeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          permissions: perms,
          ...(expiresInDays ? { expiresInDays: Number(expiresInDays) } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "作成に失敗しました");
        return;
      }
      const data = await res.json();
      setNewKey(data.key);
      setName("");
      setPerms(["read", "trade"]);
      setShowCreate(false);
      fetchKeys();
    } catch {
      alert("作成に失敗しました");
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/apikeys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    fetchKeys();
  };

  const handleDelete = async (id: string, keyName: string) => {
    if (!confirm(`APIキー「${keyName}」を削除しますか？この操作は取り消せません。`)) return;
    await fetch(`/api/apikeys/${id}`, { method: "DELETE" });
    fetchKeys();
  };

  const copyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const togglePerm = (p: string) => {
    setPerms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">APIキー</h1>
          <p className="text-sm text-gray-400 mt-1">
            AI/Botからプログラムで取引するためのAPIキーを管理します
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          + 新しいキーを作成
        </button>
      </div>

      {/* 新しいキー表示 */}
      {newKey && (
        <div className="card border-yellow-600/50 bg-yellow-900/10">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-yellow-400 mb-2">
                APIキーが作成されました
              </p>
              <p className="text-sm text-gray-400 mb-3">
                このキーは一度しか表示されません。安全な場所に保存してください。
              </p>
              <div className="flex items-center gap-2">
                <code className="bg-gray-800 px-4 py-2 rounded-lg font-mono text-sm break-all select-all">
                  {newKey}
                </code>
                <button onClick={copyKey} className="btn-secondary text-sm whitespace-nowrap">
                  {copied ? "コピー済み" : "コピー"}
                </button>
              </div>
            </div>
            <button
              onClick={() => setNewKey(null)}
              className="text-gray-500 hover:text-white text-xl leading-none"
            >
              x
            </button>
          </div>
          <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">使用例:</p>
            <code className="text-xs text-gray-300 font-mono">
              curl -H &quot;Authorization: Bearer {newKey.slice(0, 15)}...&quot;
              http://localhost:4000/api/v1/account
            </code>
          </div>
        </div>
      )}

      {/* 作成フォーム */}
      {showCreate && (
        <div className="card border-brand-600/50">
          <h3 className="font-bold text-lg mb-4">新しいAPIキーを作成</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="label">キー名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input max-w-md"
                placeholder="my-trading-bot"
                required
              />
            </div>

            <div>
              <label className="label">パーミッション</label>
              <div className="space-y-2 mt-2">
                {PERMISSION_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      perms.includes(opt.value)
                        ? "bg-brand-600/20 border border-brand-600/50"
                        : "bg-gray-800 border border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={perms.includes(opt.value)}
                      onChange={() => togglePerm(opt.value)}
                      className="w-4 h-4 rounded"
                    />
                    <div>
                      <p className="font-medium text-sm">{opt.label}</p>
                      <p className="text-xs text-gray-400">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="label">有効期限（任意）</label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : "")}
                className="input max-w-xs"
              >
                <option value="">無期限</option>
                <option value="30">30日</option>
                <option value="90">90日</option>
                <option value="180">180日</option>
                <option value="365">1年</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={creating || !name.trim() || perms.length === 0} className="btn-primary">
                {creating ? "作成中..." : "作成"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="btn-secondary"
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {/* キー一覧 */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      ) : keys.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          APIキーはまだありません。「新しいキーを作成」から作成してください。
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <div
              key={k.id}
              className={`card flex items-center justify-between ${
                !k.isActive ? "opacity-50" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <p className="font-bold">{k.name}</p>
                  {!k.isActive && (
                    <span className="text-xs bg-red-600/20 text-red-400 px-2 py-0.5 rounded">
                      無効
                    </span>
                  )}
                </div>
                <code className="text-sm text-gray-400 font-mono">{k.keyPrefix}</code>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>
                    権限:{" "}
                    {k.permissions.map((p) => (
                      <span
                        key={p}
                        className="bg-gray-800 px-1.5 py-0.5 rounded mr-1"
                      >
                        {p}
                      </span>
                    ))}
                  </span>
                  <span>
                    作成: {new Date(k.createdAt).toLocaleDateString("ja-JP")}
                  </span>
                  {k.lastUsedAt && (
                    <span>
                      最終使用: {new Date(k.lastUsedAt).toLocaleString("ja-JP")}
                      {k.lastUsedIp && ` (${k.lastUsedIp})`}
                    </span>
                  )}
                  {k.expiresAt && (
                    <span className={new Date(k.expiresAt) < new Date() ? "text-red-400" : ""}>
                      期限: {new Date(k.expiresAt).toLocaleDateString("ja-JP")}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => handleToggle(k.id, k.isActive)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    k.isActive
                      ? "bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30"
                      : "bg-green-600/20 text-green-400 hover:bg-green-600/30"
                  }`}
                >
                  {k.isActive ? "無効化" : "有効化"}
                </button>
                <button
                  onClick={() => handleDelete(k.id, k.name)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ドキュメントリンク */}
      <div className="card bg-gray-900/50">
        <h3 className="font-bold mb-2">API ドキュメント</h3>
        <p className="text-sm text-gray-400 mb-3">
          Bot APIの詳しい使い方はドキュメントを参照してください。
        </p>
        <div className="bg-gray-800 rounded-lg p-4 space-y-2 text-sm font-mono">
          <p className="text-gray-400"># 株価取得</p>
          <p>
            <span className="text-green-400">GET</span>{" "}
            <span className="text-gray-300">/api/v1/quote?symbol=7203&market=JP</span>
          </p>
          <p className="text-gray-400 mt-3"># 買い注文</p>
          <p>
            <span className="text-yellow-400">POST</span>{" "}
            <span className="text-gray-300">/api/v1/order</span>
          </p>
          <p className="text-gray-500">
            {`{ "symbol": "7203", "side": "BUY", "quantity": 100 }`}
          </p>
          <p className="text-gray-400 mt-3"># 信用売り</p>
          <p>
            <span className="text-yellow-400">POST</span>{" "}
            <span className="text-gray-300">/api/v1/order</span>
          </p>
          <p className="text-gray-500">
            {`{ "symbol": "AAPL", "market": "US", "side": "SELL", "tradeType": "MARGIN", "quantity": 10 }`}
          </p>
        </div>
      </div>
    </div>
  );
}
