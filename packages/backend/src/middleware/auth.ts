import { Request, Response, NextFunction } from "express";
import { verifyToken, prisma } from "@kabu-trade/shared";
import { validateSession } from "../lib/security.js";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    balance: number;
    balanceUsd: number;
    marginRate: number;
    isActive: boolean;
  };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // JWT検証
    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // セッションDB検証（トークン無効化に対応）
    const sessionValid = await validateSession(token);
    if (!sessionValid) {
      res.clearCookie("token", { path: "/" });
      return res.status(401).json({ error: "Session expired" });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true, email: true, name: true, role: true,
        balance: true, balanceUsd: true, marginRate: true,
        isActive: true, lockedUntil: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // アカウントロック確認
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(423).json({ error: "アカウントがロックされています" });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => {
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  });
}
