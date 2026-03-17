import { Router } from "express";
import { prisma } from "@kabu-trade/shared";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { executeFxTrade, getFxRate, placeOrder } from "../services/trading.js";
import { getUsdJpyCandles, getUsdJpyQuote } from "../services/fx.js";
import { fxTradeSchema, orderSchema } from "../lib/validation.js";
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

tradeRouter.post("/fx", tradeLimiter, async (req: AuthRequest, res) => {
  try {
    const parsed = fxTradeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const result = await executeFxTrade({
      userId: req.user!.id,
      fromCurrency: parsed.data.fromCurrency,
      toCurrency: parsed.data.toCurrency,
      amount: parsed.data.amount,
    });

    const ip = getClientIp(req);
    await audit(
      req.user!.id,
      "FX",
      `user:${req.user!.id}`,
      `${result.fromCurrency} ${result.sourceAmount} -> ${result.toCurrency} ${result.receiveAmount} @ ${result.rate}`,
      ip,
      req.headers["user-agent"] || ""
    );

    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "為替取引に失敗しました";
    res.status(400).json({ error: message });
  }
});

tradeRouter.get("/fx-rate", async (_req, res) => {
  try {
    const liveQuote = await getUsdJpyQuote().catch(() => null);
    if (liveQuote) {
      return res.json(liveQuote);
    }
    res.json({
      ...getFxRate(),
      source: "config",
      previousClose: getFxRate().rate,
      change: 0,
      changePercent: 0,
      timestamp: Date.now(),
    });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});

tradeRouter.get("/fx-candles", async (req: AuthRequest, res) => {
  try {
    const days = Math.min(Math.max(parseInt((req.query.days as string) || "90"), 7), 365);
    const result = await getUsdJpyCandles(days);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
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
