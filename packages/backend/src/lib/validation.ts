import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください").max(255),
  password: z.string().min(1, "パスワードを入力してください").max(128),
});

export const registerSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください").max(255),
  name: z.string().min(1, "名前を入力してください").max(100).transform((v) => v.trim()),
  password: z.string().min(12, "パスワードは12文字以上にしてください").max(128),
});

export const orderSchema = z.object({
  symbol: z.string().min(1).max(20).regex(/^[A-Z0-9.]+$/i, "無効な銘柄コードです"),
  market: z.enum(["JP", "US"]).default("JP"),
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["MARKET", "LIMIT"]).default("MARKET"),
  tradeType: z.enum(["SPOT", "MARGIN"]).default("SPOT"),
  quantity: z.number().int().min(1, "数量は1以上にしてください").max(1000000),
  price: z.number().positive().optional(),
}).refine(
  (data) => data.type !== "LIMIT" || data.price !== undefined,
  { message: "指値注文には価格が必要です", path: ["price"] }
);

export const apiKeyCreateSchema = z.object({
  name: z.string().min(1).max(50).transform((v) => v.trim()),
  permissions: z.array(z.enum(["read", "trade", "margin", "*"])).min(1).max(4),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export const adminUserUpdateSchema = z.object({
  balance: z.number().min(0).max(999999999999).optional(),
  balanceUsd: z.number().min(0).max(999999999999).optional(),
  marginRate: z.number().min(1).max(10).optional(),
  isActive: z.boolean().optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
});

export const symbolQuerySchema = z.object({
  symbol: z.string().min(1).max(20),
  market: z.enum(["JP", "US"]).default("JP"),
});

export const marginCloseSchema = z.object({
  positionId: z.string().min(1).max(100),
});
