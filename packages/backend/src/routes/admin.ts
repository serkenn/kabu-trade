import { Router } from "express";
import { prisma } from "@kabu-trade/shared";
import { requireAdmin, type AuthRequest } from "../middleware/auth.js";
import { adminUserUpdateSchema } from "../lib/validation.js";
import { audit, getClientIp } from "../lib/security.js";

export const adminRouter = Router();
adminRouter.use(requireAdmin as never);

adminRouter.get("/users", async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || "1"));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "20")));
    const search = ((req.query.search as string) || "").slice(0, 100);

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, name: true, role: true,
          balance: true, balanceUsd: true, marginRate: true,
          isActive: true, createdAt: true, lastLoginAt: true, failedLoginAttempts: true,
          _count: { select: { orders: true, holdings: true, marginPositions: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page, limit });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});

adminRouter.get("/users/:id", async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        holdings: true,
        marginPositions: { where: { status: "OPEN" } },
        orders: { orderBy: { createdAt: "desc" }, take: 50 },
        transactions: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });

    // パスワードハッシュは返さない
    const { passwordHash: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});

adminRouter.patch("/users/:id", async (req: AuthRequest, res) => {
  const ip = getClientIp(req);
  const ua = req.headers["user-agent"] || "";

  try {
    const { id } = req.params;
    const parsed = adminUserUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const data = parsed.data;

    const currentUser = await prisma.user.findUniqueOrThrow({ where: { id } });

    // 残高変更は監査ログ + トランザクション記録
    if (data.balance !== undefined && data.balance !== currentUser.balance) {
      const diff = data.balance - currentUser.balance;
      await prisma.transaction.create({
        data: {
          userId: id, type: "ADMIN_ADJUST", amount: diff, currency: "JPY",
          description: `管理者による残高調整: ${currentUser.balance} → ${data.balance}`,
        },
      });
      await audit(
        req.user!.id, "ADMIN_BALANCE_ADJUST", `user:${id}`,
        `JPY: ${currentUser.balance} → ${data.balance} (${diff >= 0 ? "+" : ""}${diff})`,
        ip, ua, "WARNING"
      );
    }

    if (data.balanceUsd !== undefined && data.balanceUsd !== currentUser.balanceUsd) {
      const diff = data.balanceUsd - currentUser.balanceUsd;
      await prisma.transaction.create({
        data: {
          userId: id, type: "ADMIN_ADJUST", amount: diff, currency: "USD",
          description: `管理者によるUSD残高調整: ${currentUser.balanceUsd} → ${data.balanceUsd}`,
        },
      });
      await audit(
        req.user!.id, "ADMIN_BALANCE_ADJUST", `user:${id}`,
        `USD: ${currentUser.balanceUsd} → ${data.balanceUsd}`,
        ip, ua, "WARNING"
      );
    }

    // ロール変更は CRITICAL
    if (data.role !== undefined && data.role !== currentUser.role) {
      await audit(
        req.user!.id, "ADMIN_ROLE_CHANGE", `user:${id}`,
        `${currentUser.role} → ${data.role}`,
        ip, ua, "CRITICAL"
      );
    }

    // アカウント無効化は WARNING
    if (data.isActive !== undefined && data.isActive !== currentUser.isActive) {
      await audit(
        req.user!.id, data.isActive ? "ADMIN_ACTIVATE_USER" : "ADMIN_DEACTIVATE_USER",
        `user:${id}`, null, ip, ua, "WARNING"
      );
    }

    const user = await prisma.user.update({ where: { id }, data });
    const { passwordHash: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});

adminRouter.get("/transactions", async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || "1"));
    const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) || "50")));
    const userId = req.query.userId as string | undefined;

    const where = userId ? { userId } : {};

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({ transactions, total, page, limit });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});

/** 監査ログ閲覧 (管理者のみ) */
adminRouter.get("/audit-logs", async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || "1"));
    const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) || "50")));
    const severity = req.query.severity as string | undefined;
    const action = req.query.action as string | undefined;
    const userId = req.query.userId as string | undefined;

    const where = {
      ...(severity ? { severity } : {}),
      ...(action ? { action } : {}),
      ...(userId ? { userId } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total, page, limit });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});
