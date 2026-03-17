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
          authProvider: true, externalId: true, discordId: true, discordRoles: true,
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

/** ランキング (総資産評価額・損益率) */
adminRouter.get("/rankings", async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true, email: true, name: true, role: true,
        balance: true, balanceUsd: true,
        holdings: { select: { symbol: true, market: true, quantity: true, avgCost: true } },
        marginPositions: {
          where: { status: "OPEN" },
          select: { symbol: true, market: true, side: true, quantity: true, entryPrice: true, margin: true },
        },
      },
    });

    // 全ユーザーの保有銘柄から一意なシンボルを収集
    const symbolSet = new Set<string>();
    for (const u of users) {
      for (const h of u.holdings) symbolSet.add(`${h.symbol}:${h.market}`);
      for (const m of u.marginPositions) symbolSet.add(`${m.symbol}:${m.market}`);
    }

    // 各銘柄の現在価格を取得
    const { getQuote } = await import("../services/stocks/index.js");
    const priceMap = new Map<string, number>();
    const pricePromises = Array.from(symbolSet).map(async (key) => {
      const [symbol, market] = key.split(":");
      try {
        const q = await getQuote(symbol, market as "JP" | "US");
        priceMap.set(key, q.price);
      } catch {
        // 価格取得失敗は無視
      }
    });
    await Promise.all(pricePromises);

    // ランキング計算
    const rankings = users.map((u) => {
      let holdingsValueJpy = 0;
      let holdingsCostJpy = 0;
      let holdingsValueUsd = 0;
      let holdingsCostUsd = 0;

      for (const h of u.holdings) {
        const price = priceMap.get(`${h.symbol}:${h.market}`);
        const marketValue = price ? price * h.quantity : h.avgCost * h.quantity;
        const costBasis = h.avgCost * h.quantity;
        if (h.market === "JP") {
          holdingsValueJpy += marketValue;
          holdingsCostJpy += costBasis;
        } else {
          holdingsValueUsd += marketValue;
          holdingsCostUsd += costBasis;
        }
      }

      // 信用ポジションの含み損益
      let marginPnlJpy = 0;
      let marginPnlUsd = 0;
      for (const m of u.marginPositions) {
        const price = priceMap.get(`${m.symbol}:${m.market}`);
        if (!price) continue;
        const pnl = m.side === "LONG"
          ? (price - m.entryPrice) * m.quantity
          : (m.entryPrice - price) * m.quantity;
        if (m.market === "JP") marginPnlJpy += pnl;
        else marginPnlUsd += pnl;
      }

      const totalAssetJpy = u.balance + holdingsValueJpy + marginPnlJpy;
      const totalAssetUsd = u.balanceUsd + holdingsValueUsd + marginPnlUsd;
      const totalCostJpy = holdingsCostJpy;
      const totalCostUsd = holdingsCostUsd;
      const totalPnlJpy = holdingsValueJpy - holdingsCostJpy + marginPnlJpy;
      const totalPnlUsd = holdingsValueUsd - holdingsCostUsd + marginPnlUsd;
      const pnlRateJpy = totalCostJpy > 0 ? (totalPnlJpy / totalCostJpy) * 100 : 0;
      const pnlRateUsd = totalCostUsd > 0 ? (totalPnlUsd / totalCostUsd) * 100 : 0;

      return {
        id: u.id, name: u.name, email: u.email, role: u.role,
        totalAssetJpy, totalAssetUsd,
        totalPnlJpy, totalPnlUsd,
        pnlRateJpy, pnlRateUsd,
        holdingsCount: u.holdings.length,
        marginCount: u.marginPositions.length,
      };
    });

    // 総資産額(JPY)でソート
    rankings.sort((a, b) => b.totalAssetJpy - a.totalAssetJpy);

    res.json({ rankings, pricesFetched: priceMap.size, symbolsTotal: symbolSet.size });
  } catch (error: unknown) {
    console.error("[admin/rankings] Error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});

/** ユーザー詳細（現在価格付き） */
adminRouter.get("/users/:id/portfolio", async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.params.id },
      select: {
        id: true, name: true, email: true, role: true,
        balance: true, balanceUsd: true, marginRate: true,
        holdings: true,
        marginPositions: { where: { status: "OPEN" } },
      },
    });

    // 保有銘柄の現在価格取得
    const { getQuote } = await import("../services/stocks/index.js");
    const holdingsWithPrice = await Promise.all(
      user.holdings.map(async (h) => {
        try {
          const q = await getQuote(h.symbol, h.market as "JP" | "US");
          const marketValue = q.price * h.quantity;
          const costBasis = h.avgCost * h.quantity;
          return {
            ...h,
            currentPrice: q.price,
            marketValue,
            pnl: marketValue - costBasis,
            pnlPercent: costBasis > 0 ? ((marketValue - costBasis) / costBasis) * 100 : 0,
          };
        } catch {
          return {
            ...h,
            currentPrice: null,
            marketValue: h.avgCost * h.quantity,
            pnl: 0,
            pnlPercent: 0,
          };
        }
      })
    );

    // 信用ポジションの現在価格取得
    const marginWithPrice = await Promise.all(
      user.marginPositions.map(async (m) => {
        try {
          const q = await getQuote(m.symbol, m.market as "JP" | "US");
          const pnl = m.side === "LONG"
            ? (q.price - m.entryPrice) * m.quantity
            : (m.entryPrice - q.price) * m.quantity;
          return { ...m, currentPrice: q.price, pnl };
        } catch {
          return { ...m, currentPrice: null, pnl: 0 };
        }
      })
    );

    res.json({
      ...user,
      holdings: holdingsWithPrice,
      marginPositions: marginWithPrice,
    });
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
