"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const userNav = [
  { href: "/trade", label: "取引", icon: "📊" },
  { href: "/portfolio", label: "ポートフォリオ", icon: "💼" },
  { href: "/margin", label: "信用取引", icon: "📈" },
  { href: "/rankings", label: "ランキング", icon: "🏆" },
  { href: "/history", label: "履歴", icon: "📋" },
  { href: "/apikeys", label: "API", icon: "🔑" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const navContent = (
    <>
      <nav className="flex-1 py-2 space-y-0.5 px-2">
        {userNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-2 px-2 py-2.5 md:py-2 rounded text-sm md:text-xs transition-colors ${
              pathname === item.href
                ? "bg-brand-600/20 text-brand-400"
                : "text-gray-400 md:text-gray-500 hover:text-white hover:bg-gray-800"
            }`}
          >
            <span className="text-base shrink-0">{item.icon}</span>
            <span className="md:opacity-0 md:group-hover:opacity-100 transition-opacity whitespace-nowrap">{item.label}</span>
          </Link>
        ))}

        {user?.role === "ADMIN" && (
          <a
            href={`${typeof window !== "undefined" ? window.location.protocol + "//" + window.location.hostname : ""}:3001`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-2 py-2.5 md:py-2 rounded text-sm md:text-xs text-purple-400 hover:text-purple-300 hover:bg-gray-800 mt-4"
          >
            <span className="text-base shrink-0">⚙️</span>
            <span className="md:opacity-0 md:group-hover:opacity-100 transition-opacity whitespace-nowrap">管理画面</span>
          </a>
        )}
      </nav>

      <div className="px-2 py-3 border-t border-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 bg-brand-600 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">
            {user?.name?.charAt(0) || "?"}
          </div>
          <div className="flex-1 min-w-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <p className="text-[11px] font-medium truncate">{user?.name}</p>
            <p className="text-[9px] text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full text-left text-sm md:text-[11px] text-gray-500 hover:text-red-400 transition-colors px-2 py-1 md:opacity-0 md:group-hover:opacity-100"
        >
          ログアウト
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-gray-900 border-b border-gray-800 flex items-center h-12 px-3">
        <button
          onClick={() => setOpen(!open)}
          className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <span className="text-brand-400 font-bold text-sm ml-1">KabuTrade</span>
        <div className="flex-1" />
        <span className="text-[10px] text-gray-500">{user?.name}</span>
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed top-12 left-0 bottom-0 z-50 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transform transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-14 hover:w-52 transition-all duration-200 bg-gray-900 border-r border-gray-800 flex-col group overflow-hidden shrink-0">
        <div className="px-3 py-3 border-b border-gray-800">
          <div className="text-brand-400 font-bold text-lg leading-none">K</div>
          <p className="text-[10px] text-gray-600 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">KabuTrade</p>
        </div>
        {navContent}
      </aside>
    </>
  );
}
