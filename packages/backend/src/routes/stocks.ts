import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { getQuote, getCandles, searchSymbols } from "../services/stocks/index.js";
import type { Market } from "@prisma/client";

export const stocksRouter = Router();
stocksRouter.use(requireAuth as never);

stocksRouter.get("/quote", async (req: AuthRequest, res) => {
  try {
    const symbol = req.query.symbol as string;
    const market = (req.query.market as Market) || "JP";
    if (!symbol) return res.status(400).json({ error: "symbol is required" });

    const quote = await getQuote(symbol, market);
    res.json(quote);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error";
    res.status(500).json({ error: message });
  }
});

stocksRouter.get("/search", async (req: AuthRequest, res) => {
  try {
    const q = (req.query.q as string) || "";
    const market = (req.query.market as Market) || "JP";
    if (!q) return res.json([]);

    const results = await searchSymbols(q, market);
    res.json(results);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error";
    res.status(500).json({ error: message });
  }
});

stocksRouter.get("/candles", async (req: AuthRequest, res) => {
  try {
    const symbol = req.query.symbol as string;
    const market = (req.query.market as Market) || "JP";
    const days = parseInt((req.query.days as string) || "90");
    if (!symbol) return res.status(400).json({ error: "symbol is required" });

    const candles = await getCandles(symbol, market, days);
    if (candles.length === 0) {
      console.warn(`[candles] No data for ${symbol} (${market}, ${days}d)`);
    }
    res.json(candles);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error";
    console.error(`[candles] Error for ${req.query.symbol} (${req.query.market}):`, message);
    res.status(500).json({ error: message });
  }
});
