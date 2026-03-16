import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import {
  securityHeaders, generalLimiter, botLimiter,
  requestIdMiddleware, requestLogger, payloadSizeGuard,
} from "./middleware/security.js";
import { authRouter } from "./routes/auth.js";
import { stocksRouter } from "./routes/stocks.js";
import { tradeRouter } from "./routes/trade.js";
import { marginRouter } from "./routes/margin.js";
import { accountRouter } from "./routes/account.js";
import { adminRouter } from "./routes/admin.js";
import { botRouter } from "./routes/bot.js";
import { apiKeysRouter } from "./routes/apikeys.js";
import { watchlistRouter } from "./routes/watchlist.js";
import { cleanExpiredSessions } from "./lib/security.js";

const app = express();
const PORT = parseInt(process.env.PORT || "4000");

// ==================== グローバルセキュリティ ====================

// リクエストID（全レスポンスに付与）
app.use(requestIdMiddleware);

// セキュリティヘッダー (Helmet)
app.use(securityHeaders);

// リクエストログ
app.use(requestLogger);

// ペイロードサイズ制限 (100KB)
app.use(payloadSizeGuard());

// CORS
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    process.env.FRONTEND_URL || "",
    process.env.ADMIN_URL || "",
  ].filter(Boolean),
  credentials: true,
}));

// Body parser
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// ==================== レート制限 ====================

// 一般API: 100 req/min
app.use("/api", generalLimiter);

// Bot API: 60 req/min (APIキーごと)
app.use("/api/v1", botLimiter);

// ==================== ルート ====================

// Health check (認証不要)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// 認証 (独自のレート制限あり)
app.use("/api/auth", authRouter);

// ユーザー向けAPI (Cookie認証)
app.use("/api/stocks", stocksRouter);
app.use("/api/trade", tradeRouter);
app.use("/api/margin", marginRouter);
app.use("/api/account", accountRouter);
app.use("/api/apikeys", apiKeysRouter);
app.use("/api/watchlist", watchlistRouter);

// 管理者API (Cookie認証 + ADMIN)
app.use("/api/admin", adminRouter);

// Bot API (APIキー認証)
app.use("/api/v1", botRouter);

// ==================== エラーハンドリング ====================

// 未知のルート
app.use("/api/*", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// グローバルエラーハンドラ
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[UNHANDLED ERROR]", err);
  res.status(500).json({ error: "Internal server error" });
});

// ==================== セッションクリーンアップ ====================

// 1時間ごとに期限切れセッションを削除
setInterval(async () => {
  try {
    const count = await cleanExpiredSessions();
    if (count > 0) console.log(`Cleaned ${count} expired sessions`);
  } catch (err) {
    console.error("Session cleanup error:", err);
  }
}, 60 * 60 * 1000);

// ==================== 起動 ====================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend API server running on port ${PORT}`);
  console.log(`Security: Helmet, Rate limiting, Session management, Audit logging enabled`);
});
