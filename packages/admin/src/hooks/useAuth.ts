"use client";

import { create } from "zustand";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  balance: number;
  balanceUsd: number;
  marginRate: number;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  fetchUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,

  fetchUser: async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        set({ user: data.user, loading: false });
      } else {
        set({ user: null, loading: false });
      }
    } catch {
      set({ user: null, loading: false });
    }
  },

  login: async (email, password) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "ログインに失敗しました");
    }
    const data = await res.json();
    set({ user: data.user });
  },

  register: async (email, name, password) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "登録に失敗しました");
    }
    const data = await res.json();
    set({ user: data.user });
  },

  logout: async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    set({ user: null });
  },
}));
