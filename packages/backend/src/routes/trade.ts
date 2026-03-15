import { Router } from "express";
import { prisma } from "@kabu-trade/shared";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { placeOrder } from "../services/trading.js";
import { orderSchema } from "../lib/validation.js";
import { tradeLimiter } from "../middleware/security.js";
import { audit, getClientIp } from "../lib/security.js";

export const tradeRouter = Router();
tradeRouter.use(requireAuth as never);

tradeRouter.post("/order", tradeLimiter, async (req: AuthRequest, res) => {
  try {
    const parsed = orderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const data = parsed.data;

    const order = await placeOrder({
      userId: req.user!.id,
      symbol: data.symbol,
      market: data.market,
      side: data.side,
      type: data.type,
      tradeType: data.tradeType,
      quantity: data.quantity,
      price: data.price,
    });

    const ip = getClientIp(req);
    await audit(
      req.user!.id, "ORDER", `order:${order.id}`,
      `${data.side} ${data.symbol} x${data.quantity} @${order.filledPrice || data.price || "MARKET"} [${data.tradeType}]`,
      ip, req.headers["user-agent"] || ""
    );

    res.json(order);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "注文に失敗しました";
    res.status(400).json({ error: message });
  }
});

tradeRouter.get("/holdings", async (req: AuthRequest, res) => {
  try {
    const holdings = await prisma.holding.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: "desc" },
    });
    res.json(holdings);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});

tradeRouter.get("/orders", async (req: AuthRequest, res) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = Math.min(parseInt((req.query.limit as string) || "100"), 200);

    const orders = await prisma.order.findMany({
      where: {
        userId: req.user!.id,
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json(orders);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});
