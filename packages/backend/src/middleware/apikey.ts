import { Request, Response, NextFunction } from "express";
import { prisma } from "@kabu-trade/shared";
import { sha256, getClientIp } from "../lib/security.js";

export interface ApiKeyRequest extends Request {
  apiUser?: {
    id: string;
    email: string;
    name: string;
    role: string;
    balance: number;
    balanceUsd: number;
    marginRate: number;
    isActive: boolean;
  };
  apiKey?: {
    id: string;
    name: string;
    permissions: string[];
  };
}

export async function requireApiKey(req: ApiKeyRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing API key. Use: Authorization: Bearer <api_key>" });
    }

    const rawKey = authHeader.slice(7);

    // プレフィックス形式チェック
    if (!rawKey.startsWith("kt_") || rawKey.length < 20) {
      return res.status(401).json({ error: "Invalid API key format" });
    }

    // ハッシュで検索（平文キーはDBに保存しない）
    const keyHash = sha256(rawKey);
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: {
          select: {
            id: true, email: true, name: true, role: true,
            balance: true, balanceUsd: true, marginRate: true, isActive: true,
          },
        },
      },
    });

    if (!apiKey || !apiKey.isActive) {
      return res.status(401).json({ error: "Invalid or inactive API key" });
    }

    // 有効期限チェック
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return res.status(401).json({ error: "API key has expired" });
    }

    if (!apiKey.user.isActive) {
      return res.status(403).json({ error: "Account is disabled" });
    }

    const ip = getClientIp(req);

    // 最終使用日時・IP更新（非同期）
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date(), lastUsedIp: ip },
    }).catch(() => {});

    req.apiUser = apiKey.user;
    req.apiKey = {
      id: apiKey.id,
      name: apiKey.name,
      permissions: apiKey.permissions,
    };
    next();
  } catch {
    return res.status(500).json({ error: "Authentication failed" });
  }
}

export function requirePermission(...perms: string[]) {
  return (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({ error: "No API key" });
    }
    const has = req.apiKey.permissions;
    if (has.includes("*") || perms.every((p) => has.includes(p))) {
      return next();
    }
    return res.status(403).json({
      error: `Insufficient permissions. Required: ${perms.join(", ")}`,
    });
  };
}
