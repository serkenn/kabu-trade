import { Router } from "express";
import { prisma } from "@kabu-trade/shared";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

export const watchlistRouter = Router();
watchlistRouter.use(requireAuth);

// GET /api/watchlist
watchlistRouter.get("/", async (req: AuthRequest, res) => {
  try {
    const items = await prisma.watchlist.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "asc" },
    });
    res.json(items);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});

// POST /api/watchlist
watchlistRouter.post("/", async (req: AuthRequest, res) => {
  try {
    const { symbol, market, name } = req.body;
    console.log("[watchlist] POST:", { symbol, market, name, userId: req.user!.id });
    if (!symbol || !market) {
      return res.status(400).json({ error: "symbol and market are required" });
    }
    if (market !== "JP" && market !== "US") {
      return res.status(400).json({ error: "market must be JP or US" });
    }

    const item = await prisma.watchlist.upsert({
      where: {
        userId_symbol_market: {
          userId: req.user!.id,
          symbol: String(symbol),
          market,
        },
      },
      update: { name: name || "" },
      create: {
        userId: req.user!.id,
        symbol: String(symbol),
        market,
        name: name || "",
      },
    });
    console.log("[watchlist] Created:", item.id);
    res.json(item);
  } catch (error: unknown) {
    console.error("[watchlist] POST error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});

// DELETE /api/watchlist/:symbol/:market
watchlistRouter.delete("/:symbol/:market", async (req: AuthRequest, res) => {
  try {
    const { symbol, market } = req.params;
    await prisma.watchlist.deleteMany({
      where: {
        userId: req.user!.id,
        symbol,
        market: market as "JP" | "US",
      },
    });
    res.json({ ok: true });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});
