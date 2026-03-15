"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const userNav = [
  { href: "/trade", label: "取引", icon: "📊" },
  { href: "/portfolio", label: "ポートフォリオ", icon: "💼" },
  { href: "/margin", label: "信用取引", icon: "📈" },
  { href: "/history", label: "取引履歴", icon: "📋" },
  { href: "/apikeys", label: "APIキー", icon: "🔑" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold text-brand-400">KabuTrade</h1>
        <p className="text-xs text-gray-500 mt-1">デモトレード</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">取引</p>
        {userNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === item.href
                ? "bg-brand-600/20 text-brand-400"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}

        {user?.role === "ADMIN" && (
          <a
            href={`${typeof window !== "undefined" ? window.location.protocol + "//" + window.location.hostname : ""}:3001`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-purple-400 hover:text-purple-300 hover:bg-gray-800 mt-6"
          >
            <span>⚙️</span>
            管理画面
          </a>
        )}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-sm font-bold">
            {user?.name?.charAt(0) || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full text-left text-sm text-gray-400 hover:text-red-400 transition-colors px-3 py-1"
        >
          ログアウト
        </button>
      </div>
    </aside>
  );
}
