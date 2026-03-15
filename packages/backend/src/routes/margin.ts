import { Router } from "express";
import { prisma } from "@kabu-trade/shared";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { closeMarginPosition } from "../services/trading.js";
import { marginCloseSchema } from "../lib/validation.js";
import { audit, getClientIp } from "../lib/security.js";

export const marginRouter = Router();
marginRouter.use(requireAuth as never);

marginRouter.get("/positions", async (req: AuthRequest, res) => {
  try {
    const status = (req.query.status as string) || "OPEN";
    const positions = await prisma.marginPosition.findMany({
      where: { userId: req.user!.id, status: status as never },
      orderBy: { createdAt: "desc" },
    });
    res.json(positions);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});

marginRouter.post("/close", async (req: AuthRequest, res) => {
  try {
    const parsed = marginCloseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const result = await closeMarginPosition(req.user!.id, parsed.data.positionId);

    const ip = getClientIp(req);
    await audit(
      req.user!.id, "MARGIN_CLOSE", `margin:${parsed.data.positionId}`,
      `PnL: ${result.pnl >= 0 ? "+" : ""}${result.pnl.toFixed(0)} @${result.exitPrice}`,
      ip, req.headers["user-agent"] || ""
    );

    res.json(result);
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : "決済に失敗しました" });
  }
});
