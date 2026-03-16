"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function AuthCodeHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const authCode = searchParams.get("auth_code");
    if (!authCode) return;

    // ワンタイムコードをバックエンドに送信してcookieを設定
    fetch(`/api/auth/claim?code=${encodeURIComponent(authCode)}`)
      .then((res) => {
        if (res.ok) {
          // auth_code パラメータを除去してリロード
          const url = new URL(window.location.href);
          url.searchParams.delete("auth_code");
          window.location.replace(url.pathname + url.search);
        }
      })
      .catch(() => {
        // 失敗しても画面は表示する
      });
  }, [searchParams, router]);

  return null;
}
