/**
 * AI/Bot 取引API
 * Bearer token認証（APIキー）でアクセス
 */

import { Router } from "express";
import { prisma } from "@kabu-trade/shared";
import { requireApiKey, requirePermission, type ApiKeyRequest } from "../middleware/apikey.js";
import { placeOrder, closeMarginPosition } from "../services/trading.js";
import { getQuote, getCandles, searchSymbols } from "../services/stocks/index.js";
import type { Market } from "@prisma/client";

export const botRouter = Router();
botRouter.use(requireApiKey as never);

// ==================== アカウント ====================

/** GET /api/v1/account - 残高・保有銘柄・信用ポジション取得 */
botRouter.get("/account", requirePermission("read"), async (req: ApiKeyRequest, res) => {
  try {
    const userId = req.apiUser!.id;
    const [holdings, marginPositions] = await Promise.all([
      prisma.holding.findMany({ where: { userId } }),
      prisma.marginPosition.findMany({ where: { userId, status: "OPEN" } }),
    ]);

    const totalMarginUsed = marginPositions.reduce((s, p) => s + p.margin, 0);

    res.json({
      balance: { jpy: req.apiUser!.balance, usd: req.apiUser!.balanceUsd },
      margin: { rate: req.apiUser!.marginRate, used: totalMarginUsed },
      holdings: holdings.map((h) => ({
        symbol: h.symbol,
        market: h.market,
        quantity: h.quantity,
        avgCost: h.avgCost,
      })),
      marginPositions: marginPositions.map((p) => ({
        id: p.id,
        symbol: p.symbol,
        market: p.market,
        side: p.side,
        quantity: p.quantity,
        entryPrice: p.entryPrice,
        margin: p.margin,
        createdAt: p.createdAt,
      })),
    });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});

// ==================== 株価データ ====================

/** GET /api/v1/quote?symbol=AAPL&market=US - リアルタイム株価 */
botRouter.get("/quote", requirePermission("read"), async (req: ApiKeyRequest, res) => {
  try {
    const symbol = req.query.symbol as string;
    const market = (req.query.market as Market) || "JP";
    if (!symbol) return res.status(400).json({ error: "symbol is required" });

    const quote = await getQuote(symbol, market);
    res.json(quote);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});

/** GET /api/v1/quotes?symbols=AAPL,MSFT,GOOG&market=US - 複数銘柄の株価一括取得 */
botRouter.get("/quotes", requirePermission("read"), async (req: ApiKeyRequest, res) => {
  try {
    const symbolsStr = req.query.symbols as string;
    const market = (req.query.market as Market) || "JP";
    if (!symbolsStr) return res.status(400).json({ error: "symbols is required" });

    const symbols = symbolsStr.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);
    const results = await Promise.allSettled(
      symbols.map((symbol) => getQuote(symbol, market))
    );

    const quotes = results.map((r, i) => ({
      symbol: symbols[i],
      ...(r.status === "fulfilled" ? { data: r.value } : { error: r.reason?.message || "Failed" }),
    }));

    res.json({ quotes });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});

/** GET /api/v1/candles?symbol=7203&market=JP&days=90 - ローソク足データ */
botRouter.get("/candles", requirePermission("read"), async (req: ApiKeyRequest, res) => {
  try {
    const symbol = req.query.symbol as string;
    const market = (req.query.market as Market) || "JP";
    const days = Math.min(parseInt((req.query.days as string) || "90"), 365);
    if (!symbol) return res.status(400).json({ error: "symbol is required" });

    const candles = await getCandles(symbol, market, days);
    res.json({ symbol, market, days, candles });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});

/** GET /api/v1/search?q=toyota&market=JP - 銘柄検索 */
botRouter.get("/search", requirePermission("read"), async (req: ApiKeyRequest, res) => {
  try {
    const q = (req.query.q as string) || "";
    const market = (req.query.market as Market) || "JP";
    if (!q) return res.json({ results: [] });

    const results = await searchSymbols(q, market);
    res.json({ results });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});

// ==================== 注文 ====================

/** POST /api/v1/order - 注文発注 */
botRouter.post("/order", requirePermission("trade"), async (req: ApiKeyRequest, res) => {
  try {
    const { symbol, market, side, type, tradeType, quantity, price } = req.body;

    if (!symbol) return res.status(400).json({ error: "symbol is required" });
    if (!side || !["BUY", "SELL"].includes(side)) {
      return res.status(400).json({ error: "side must be BUY or SELL" });
    }
    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: "quantity must be >= 1" });
    }

    const order = await placeOrder({
      userId: req.apiUser!.id,
      symbol,
      market: market || "JP",
      side,
      type: type || "MARKET",
      tradeType: tradeType || "SPOT",
      quantity: parseInt(quantity),
      price: price ? parseFloat(price) : undefined,
    });

    res.json({
      orderId: order.id,
      symbol: order.symbol,
      market: order.market,
      side: order.side,
      type: order.type,
      tradeType: order.tradeType,
      quantity: order.quantity,
      filledPrice: order.filledPrice,
      filledQty: order.filledQty,
      status: order.status,
      createdAt: order.createdAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Order failed";
    res.status(400).json({ error: message });
  }
});

/** GET /api/v1/orders - 注文履歴 */
botRouter.get("/orders", requirePermission("read"), async (req: ApiKeyRequest, res) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = Math.min(parseInt((req.query.limit as string) || "50"), 200);
    const offset = parseInt((req.query.offset as string) || "0");

    const orders = await prisma.order.findMany({
      where: {
        userId: req.apiUser!.id,
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    res.json({
      orders: orders.map((o) => ({
        id: o.id,
        symbol: o.symbol,
        market: o.market,
        side: o.side,
        type: o.type,
        tradeType: o.tradeType,
        quantity: o.quantity,
        price: o.price,
        filledPrice: o.filledPrice,
        filledQty: o.filledQty,
        status: o.status,
        createdAt: o.createdAt,
      })),
      limit,
      offset,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});

// ==================== 信用取引 ====================

/** POST /api/v1/margin/close - 信用ポジション決済 */
botRouter.post(
  "/margin/close",
  requirePermission("margin"),
  async (req: ApiKeyRequest, res) => {
    try {
      const { positionId } = req.body;
      if (!positionId) return res.status(400).json({ error: "positionId is required" });

      const result = await closeMarginPosition(req.apiUser!.id, positionId);
      res.json(result);
    } catch (error: unknown) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
  }
);

/** GET /api/v1/margin/positions - 信用ポジション一覧 */
botRouter.get("/margin/positions", requirePermission("read"), async (req: ApiKeyRequest, res) => {
  try {
    const status = (req.query.status as string) || "OPEN";
    const positions = await prisma.marginPosition.findMany({
      where: { userId: req.apiUser!.id, status: status as never },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      positions: positions.map((p) => ({
        id: p.id,
        symbol: p.symbol,
        market: p.market,
        side: p.side,
        quantity: p.quantity,
        entryPrice: p.entryPrice,
        exitPrice: p.exitPrice,
        margin: p.margin,
        status: p.status,
        createdAt: p.createdAt,
        closedAt: p.closedAt,
      })),
    });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});
