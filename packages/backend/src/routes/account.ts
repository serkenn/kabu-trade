import { Router } from "express";
import { prisma } from "@kabu-trade/shared";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { getQuote } from "../services/stocks/index.js";

export const accountRouter = Router();

accountRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const [holdings, marginPositions, recentTransactions] = await Promise.all([
      prisma.holding.findMany({ where: { userId } }),
      prisma.marginPosition.findMany({ where: { userId, status: "OPEN" } }),
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const totalMarginUsed = marginPositions.reduce((sum, p) => sum + p.margin, 0);

    res.json({
      user: req.user,
      holdings,
      marginPositions,
      totalMarginUsed,
      recentTransactions,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});

/** ランキング（一般ユーザー向け） */
accountRouter.get("/rankings", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true,
        balance: true, balanceUsd: true,
        holdings: { select: { symbol: true, market: true, quantity: true, avgCost: true } },
        marginPositions: {
          where: { status: "OPEN" },
          select: { symbol: true, market: true, side: true, quantity: true, entryPrice: true },
        },
      },
    });

    // 全銘柄の現在価格を一括取得
    const symbolSet = new Set<string>();
    for (const u of users) {
      for (const h of u.holdings) symbolSet.add(`${h.symbol}:${h.market}`);
      for (const m of u.marginPositions) symbolSet.add(`${m.symbol}:${m.market}`);
    }

    const priceMap = new Map<string, number>();
    await Promise.all(
      Array.from(symbolSet).map(async (key) => {
        const [symbol, market] = key.split(":");
        try {
          const q = await getQuote(symbol, market as "JP" | "US");
          priceMap.set(key, q.price);
        } catch { /* ignore */ }
      })
    );

    const rankings = users.map((u) => {
      let holdingsValueJpy = 0, holdingsCostJpy = 0;
      let holdingsValueUsd = 0, holdingsCostUsd = 0;

      for (const h of u.holdings) {
        const price = priceMap.get(`${h.symbol}:${h.market}`);
        const mv = price ? price * h.quantity : h.avgCost * h.quantity;
        const cb = h.avgCost * h.quantity;
        if (h.market === "JP") { holdingsValueJpy += mv; holdingsCostJpy += cb; }
        else { holdingsValueUsd += mv; holdingsCostUsd += cb; }
      }

      let marginPnlJpy = 0, marginPnlUsd = 0;
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
      const totalPnlJpy = holdingsValueJpy - holdingsCostJpy + marginPnlJpy;
      const totalPnlUsd = holdingsValueUsd - holdingsCostUsd + marginPnlUsd;
      const pnlRateJpy = holdingsCostJpy > 0 ? (totalPnlJpy / holdingsCostJpy) * 100 : 0;
      const pnlRateUsd = holdingsCostUsd > 0 ? (totalPnlUsd / holdingsCostUsd) * 100 : 0;

      return {
        id: u.id,
        name: u.name,
        totalAssetJpy, totalAssetUsd,
        totalPnlJpy, totalPnlUsd,
        pnlRateJpy, pnlRateUsd,
        holdingsCount: u.holdings.length,
        marginCount: u.marginPositions.length,
      };
    });

    rankings.sort((a, b) => b.totalAssetJpy - a.totalAssetJpy);
    res.json(rankings);
  } catch (error: unknown) {
    console.error("[account/rankings] Error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});
