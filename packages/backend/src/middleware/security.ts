import { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { generateRequestId, getClientIp } from "../lib/security.js";

// ==================== Helmet (セキュリティヘッダー) ====================

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // API用に緩和
  hsts: {
    maxAge: 31536000,    // 1年
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xContentTypeOptions: true,  // nosniff
  xFrameOptions: { action: "deny" },
});

// ==================== レート制限 ====================

/** 一般API: 100 req/min */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "リクエストが多すぎます。しばらくしてから再試行してください。" },
  keyGenerator: (req) => getClientIp(req),
});

/** 認証API: 10 req/min (ブルートフォース対策) */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "ログイン試行が多すぎます。1分後に再試行してください。" },
  keyGenerator: (req) => getClientIp(req),
});

/** 注文API: 30 req/min */
export const tradeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "注文リクエストが多すぎます。しばらくしてから再試行してください。" },
  keyGenerator: (req) => getClientIp(req),
});

/** Bot API: 60 req/min */
export const botLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "API rate limit exceeded. Please wait and retry." },
  keyGenerator: (req) => {
    // APIキーごとにレート制限
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) return auth.slice(7, 19); // プレフィックス部分をキーにする
    return getClientIp(req);
  },
});

/** APIキー作成: 5 req/hour */
export const apiKeyCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "APIキーの作成上限に達しました。1時間後に再試行してください。" },
  keyGenerator: (req) => getClientIp(req),
});

// ==================== リクエストID ====================

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = generateRequestId();
  req.headers["x-request-id"] = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}

// ==================== リクエストログ ====================

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const ip = getClientIp(req);

  res.on("finish", () => {
    const duration = Date.now() - start;
    const log = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip,
      requestId: req.headers["x-request-id"],
    };

    // 異常なリクエストを警告
    if (res.statusCode >= 400) {
      console.warn("[REQ]", JSON.stringify(log));
    }
  });

  next();
}

// ==================== CORS 制限 ====================

export function validateOrigin(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Bot API (/api/v1) はOriginチェック不要（APIキー認証）
    if (req.path.startsWith("/api/v1")) return next();

    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) {
      // 開発環境では警告のみ
      if (process.env.NODE_ENV === "production") {
        return res.status(403).json({ error: "Origin not allowed" });
      }
    }
    next();
  };
}

// ==================== ペイロードサイズ制限 ====================

export function payloadSizeGuard(maxBytes: number = 100 * 1024) { // default 100KB
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers["content-length"] || "0");
    if (contentLength > maxBytes) {
      return res.status(413).json({ error: "Request payload too large" });
    }
    next();
  };
}
