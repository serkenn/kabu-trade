"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const OAUTH_ERRORS: Record<string, string> = {
  oauth_denied: "認証がキャンセルされました",
  oauth_invalid: "認証リクエストが不正です",
  oauth_state: "認証の検証に失敗しました。もう一度お試しください",
  oauth_expired: "認証の有効期限が切れました。もう一度お試しください",
  oauth_failed: "外部認証に失敗しました",
  account_disabled: "アカウントが無効化されています",
};

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [evexEnabled, setEvexEnabled] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // evex-accounts が有効か確認
    fetch("/api/auth/evex/status")
      .then((r) => r.json())
      .then((d) => setEvexEnabled(d.enabled))
      .catch(() => {});

    // OAuth エラーの表示
    const oauthError = searchParams.get("error");
    if (oauthError && OAUTH_ERRORS[oauthError]) {
      setError(OAUTH_ERRORS[oauthError]);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        await register(email, name, password);
      } else {
        await login(email, password);
      }
      router.push("/trade");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleEvexLogin = () => {
    window.location.href = "/api/auth/evex?redirect=/trade";
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-400">KabuTrade</h1>
          <p className="text-gray-500 mt-2">
            日本株・米国株デモトレードプラットフォーム
          </p>
        </div>

        <div className="card">
          {evexEnabled && (
            <>
              <button
                onClick={handleEvexLogin}
                className="w-full py-2.5 px-4 rounded-lg font-medium transition-colors bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Evex アカウントでログイン
              </button>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-gray-800 px-3 text-gray-500">または</span>
                </div>
              </div>
            </>
          )}

          <div className="flex mb-6">
            <button
              onClick={() => setIsRegister(false)}
              className={`flex-1 py-2 text-center font-medium transition-colors border-b-2 ${
                !isRegister
                  ? "border-brand-500 text-brand-400"
                  : "border-transparent text-gray-500"
              }`}
            >
              ログイン
            </button>
            <button
              onClick={() => setIsRegister(true)}
              className={`flex-1 py-2 text-center font-medium transition-colors border-b-2 ${
                isRegister
                  ? "border-brand-500 text-brand-400"
                  : "border-transparent text-gray-500"
              }`}
            >
              新規登録
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                required
              />
            </div>

            {isRegister && (
              <div>
                <label className="label">名前</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  required
                />
              </div>
            )}

            <div>
              <label className="label">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                minLength={8}
                required
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading
                ? "処理中..."
                : isRegister
                  ? "アカウント作成"
                  : "ログイン"}
            </button>
          </form>

          {isRegister && (
            <p className="text-xs text-gray-500 mt-4 text-center">
              初期残高: ¥10,000,000（デモ用仮想資金）
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
