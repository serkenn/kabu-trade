import { Router } from "express";
import { prisma } from "@kabu-trade/shared";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

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
