import { Router, Response } from "express";
import { prisma, hashPassword, verifyPassword, signToken } from "@kabu-trade/shared";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import {
  isEvexConfigured, generatePKCE, generateState,
  getAuthorizationUrl, exchangeCodeForTokens, fetchUserInfo,
} from "../services/evex-accounts.js";
import {
  validatePassword, getClientIp, recordFailedLogin, resetFailedLogin,
  createSession, revokeSession, revokeAllSessions, audit, sanitize,
} from "../lib/security.js";
import { loginSchema, registerSchema } from "../lib/validation.js";
import { authLimiter } from "../middleware/security.js";

export const authRouter = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const, // サブドメイン間リダイレクトに対応
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
  ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
};

// OAuth state/PKCE 一時保存用メモリストア (Cookie はプロキシ経由で失われるため)
const oauthPendingFlows = new Map<string, { codeVerifier: string; redirectUrl: string; createdAt: number }>();

// 5分以上経過したエントリを定期的にクリーンアップ
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of oauthPendingFlows) {
    if (now - val.createdAt > 5 * 60 * 1000) oauthPendingFlows.delete(key);
  }
}, 60 * 1000);

// ==================== ローカル認証 ====================

authRouter.post("/login", authLimiter, async (req: AuthRequest, res: Response) => {
  const ip = getClientIp(req);
  const ua = req.headers["user-agent"] || "";

  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { email, password } = parsed.data;

    // ローカル認証
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await audit(null, "LOGIN_FAILED", null, `Unknown email: ${email}`, ip, ua, "WARNING");
      return res.status(401).json({ error: "メールアドレスまたはパスワードが正しくありません" });
    }

    // アカウントロック確認
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return res.status(423).json({
        error: `アカウントがロックされています。${remaining}分後に再試行してください。`,
      });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const result = await recordFailedLogin(email, ip);
      if (result.locked) {
        return res.status(423).json({
          error: "ログイン試行回数が上限に達しました。15分間ロックされます。",
        });
      }
      return res.status(401).json({
        error: `メールアドレスまたはパスワードが正しくありません (残り${result.attemptsLeft}回)`,
      });
    }

    if (!user.isActive) {
      await audit(user.id, "LOGIN_FAILED", null, "Inactive account", ip, ua, "WARNING");
      return res.status(403).json({ error: "アカウントが無効化されています" });
    }

    // ログイン成功：失敗カウントリセット
    await resetFailedLogin(user.id);

    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    await createSession(user.id, token, ip, ua);

    // 最終ログイン情報更新
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    });

    await audit(user.id, "LOGIN", null, null, ip, ua);

    res.cookie("token", token, COOKIE_OPTIONS);
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    console.error("Login error:", error);
    await audit(null, "LOGIN_ERROR", null, String(error), ip, ua, "CRITICAL");
    res.status(500).json({ error: "ログインに失敗しました" });
  }
});

authRouter.post("/register", authLimiter, async (req: AuthRequest, res: Response) => {
  const ip = getClientIp(req);
  const ua = req.headers["user-agent"] || "";

  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { email, name, password } = parsed.data;

    // パスワード強度チェック
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return res.status(400).json({ error: pwCheck.errors.join("、") });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "このメールアドレスは既に登録されています" });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, name: sanitize(name), passwordHash },
    });

    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    await createSession(user.id, token, ip, ua);
    await audit(user.id, "REGISTER", `user:${user.id}`, null, ip, ua);

    res.cookie("token", token, COOKIE_OPTIONS);
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "登録に失敗しました" });
  }
});

// ==================== evex-accounts OAuth 2.0 ====================

/**
 * OAuth 認可フロー開始
 * GET /api/auth/evex?redirect=/trade
 * → evex-accounts の認可画面にリダイレクト
 */
authRouter.get("/evex", (req: AuthRequest, res: Response) => {
  if (!isEvexConfigured()) {
    return res.status(503).json({ error: "evex-accounts が設定されていません" });
  }

  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = generateState();

  // リクエスト元のOriginをクエリパラメータから取得
  const baseUrl = (typeof req.query.origin === "string" ? req.query.origin : getFrontendUrl()).replace(/\/$/, "");
  const path = typeof req.query.redirect === "string" ? req.query.redirect : "/trade";
  const redirectUrl = `${baseUrl}${path}`;

  // PKCE code_verifier と state をメモリに保存 (Cookie はプロキシ経由で失われる)
  oauthPendingFlows.set(state, { codeVerifier, redirectUrl, createdAt: Date.now() });

  const authUrl = getAuthorizationUrl(state, codeChallenge);
  res.redirect(authUrl);
});

/**
 * OAuth コールバック
 * GET /api/auth/evex/callback?code=...&state=...
 * → トークン交換 → UserInfo 取得 → ローカルユーザー作成/更新 → フロントエンドにリダイレクト
 */
authRouter.get("/evex/callback", async (req: AuthRequest, res: Response) => {
  const ip = getClientIp(req);
  const ua = req.headers["user-agent"] || "";

  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      console.error("OAuth error:", oauthError);
      return res.redirect(`${getFrontendUrl()}/login?error=oauth_denied`);
    }

    if (!code || !state) {
      return res.redirect(`${getFrontendUrl()}/login?error=oauth_invalid`);
    }

    // state 検証 (メモリストアから取得)
    const pending = oauthPendingFlows.get(state as string);
    if (!pending) {
      await audit(null, "LOGIN_FAILED", null, "OAuth state mismatch or expired", ip, ua, "WARNING");
      return res.redirect(`${getFrontendUrl()}/login?error=oauth_state`);
    }
    oauthPendingFlows.delete(state as string);

    // 5分以上経過していたら期限切れ
    if (Date.now() - pending.createdAt > 5 * 60 * 1000) {
      return res.redirect(`${getFrontendUrl()}/login?error=oauth_expired`);
    }

    const codeVerifier = pending.codeVerifier;

    // トークン交換
    const tokens = await exchangeCodeForTokens(code as string, codeVerifier);

    // UserInfo 取得
    const evexUser = await fetchUserInfo(tokens.accessToken);

    // ローカルユーザー検索 (externalId = sub)
    let user = await prisma.user.findUnique({ where: { externalId: evexUser.sub } });

    if (!user) {
      // メールアドレスで既存ユーザーを検索 → externalId を紐付け
      const existingByEmail = await prisma.user.findUnique({ where: { email: evexUser.email } });
      if (existingByEmail) {
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: { externalId: evexUser.sub, name: evexUser.name || existingByEmail.name },
        });
      } else {
        // 新規ユーザー作成
        user = await prisma.user.create({
          data: {
            externalId: evexUser.sub,
            email: evexUser.email,
            name: evexUser.name || evexUser.email.split("@")[0],
            passwordHash: "evex-oauth",
          },
        });
      }
    } else {
      // ユーザー情報を更新 (名前・メール変更に追従)
      if (user.email !== evexUser.email || user.name !== evexUser.name) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            email: evexUser.email,
            ...(evexUser.name ? { name: evexUser.name } : {}),
          },
        });
      }
    }

    if (!user.isActive) {
      await audit(user.id, "LOGIN_FAILED", null, "Inactive account (OAuth)", ip, ua, "WARNING");
      return res.redirect(`${getFrontendUrl()}/login?error=account_disabled`);
    }

    // セッション作成
    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    await createSession(user.id, token, ip, ua);

    // 最終ログイン情報更新
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    });

    await audit(user.id, "LOGIN", null, "evex-oauth", ip, ua);

    // セッション Cookie を設定
    res.cookie("token", token, COOKIE_OPTIONS);

    // リクエスト元にリダイレクト
    res.redirect(pending.redirectUrl);
  } catch (error) {
    console.error("OAuth callback error:", error);
    await audit(null, "LOGIN_ERROR", null, `OAuth: ${String(error)}`, ip, ua, "CRITICAL");
    res.redirect(`${getFrontendUrl()}/login?error=oauth_failed`);
  }
});

/**
 * evex-accounts が有効かどうかを返す (フロントエンド用)
 */
authRouter.get("/evex/status", (_req, res) => {
  res.json({ enabled: isEvexConfigured() });
});

// ==================== ログアウト・セッション ====================

authRouter.post("/logout", async (req: AuthRequest, res) => {
  const token = req.cookies?.token;
  if (token) {
    const ip = getClientIp(req);
    const ua = req.headers["user-agent"] || "";
    await revokeSession(token);
    const payload = (await import("@kabu-trade/shared")).verifyToken(token);
    if (payload) {
      await audit(payload.userId, "LOGOUT", null, null, ip, ua);
    }
  }
  res.clearCookie("token", { path: "/" });
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

/** 全セッション無効化 */
authRouter.post("/revoke-all-sessions", requireAuth, async (req: AuthRequest, res) => {
  const count = await revokeAllSessions(req.user!.id);
  const ip = getClientIp(req);
  await audit(req.user!.id, "REVOKE_ALL_SESSIONS", null, `Revoked ${count} sessions`, ip);
  res.clearCookie("token", { path: "/" });
  res.json({ ok: true, revokedCount: count });
});

// ==================== ヘルパー ====================

function getFrontendUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
