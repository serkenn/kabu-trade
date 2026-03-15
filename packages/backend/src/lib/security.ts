import crypto from "crypto";
import { prisma } from "@kabu-trade/shared";
import { Request } from "express";

// ==================== ハッシュ ====================

/** SHA-256ハッシュ生成（APIキー・トークンの保存用） */
export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/** タイミング安全な文字列比較 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ==================== APIキー生成 ====================

/** 暗号論的に安全なAPIキー生成 */
export function generateApiKey(): string {
  return `kt_${crypto.randomBytes(32).toString("hex")}`;
}

/** リクエストID生成 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

// ==================== IPアドレス取得 ====================

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

// ==================== アカウントロック ====================

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15分

export async function checkAccountLock(userId: string): Promise<{ locked: boolean; remainingMs?: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lockedUntil: true, failedLoginAttempts: true },
  });

  if (!user) return { locked: false };

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return {
      locked: true,
      remainingMs: user.lockedUntil.getTime() - Date.now(),
    };
  }

  return { locked: false };
}

export async function recordFailedLogin(email: string, ip: string): Promise<{ locked: boolean; attemptsLeft: number }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { locked: false, attemptsLeft: MAX_FAILED_ATTEMPTS };

  const attempts = user.failedLoginAttempts + 1;
  const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: attempts,
      lockedUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null,
    },
  });

  await audit(user.id, "LOGIN_FAILED", null, `Attempt ${attempts}/${MAX_FAILED_ATTEMPTS}`, ip, "", shouldLock ? "WARNING" : "INFO");

  if (shouldLock) {
    await audit(user.id, "ACCOUNT_LOCKED", `user:${user.id}`, `Locked for ${LOCK_DURATION_MS / 60000} minutes after ${MAX_FAILED_ATTEMPTS} failed attempts`, ip, "", "CRITICAL");
  }

  return { locked: shouldLock, attemptsLeft: Math.max(0, MAX_FAILED_ATTEMPTS - attempts) };
}

export async function resetFailedLogin(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}

// ==================== セッション管理 ====================

export async function createSession(userId: string, token: string, ip: string, userAgent: string): Promise<void> {
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7日

  await prisma.session.create({
    data: { userId, tokenHash, ipAddress: ip, userAgent, expiresAt },
  });
}

export async function validateSession(token: string): Promise<boolean> {
  const tokenHash = sha256(token);
  const session = await prisma.session.findUnique({ where: { tokenHash } });
  if (!session) return false;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return false;
  }
  return true;
}

export async function revokeSession(token: string): Promise<void> {
  const tokenHash = sha256(token);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

export async function revokeAllSessions(userId: string): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { userId } });
  return result.count;
}

/** 期限切れセッション一括削除 */
export async function cleanExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

// ==================== 監査ログ ====================

export async function audit(
  userId: string | null,
  action: string,
  resource: string | null,
  detail: string | null,
  ipAddress: string,
  userAgent: string = "",
  severity: "INFO" | "WARNING" | "CRITICAL" = "INFO"
): Promise<void> {
  await prisma.auditLog.create({
    data: { userId, action, resource, detail, ipAddress, userAgent, severity },
  }).catch((err) => {
    console.error("Audit log failed:", err);
  });
}


// ==================== パスワードポリシー ====================

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push("12文字以上にしてください");
  }
  if (password.length > 128) {
    errors.push("128文字以下にしてください");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("大文字を1文字以上含めてください");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("小文字を1文字以上含めてください");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("数字を1文字以上含めてください");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("記号を1文字以上含めてください");
  }

  // よくあるパスワードチェック
  const common = ["password", "12345678", "qwerty", "admin", "letmein", "welcome"];
  if (common.some((c) => password.toLowerCase().includes(c))) {
    errors.push("一般的なパスワードは使用できません");
  }

  return { valid: errors.length === 0, errors };
}

// ==================== 入力サニタイズ ====================

/** HTMLタグ除去 */
export function sanitize(input: string): string {
  return input.replace(/[<>"'&]/g, (char) => {
    const entities: Record<string, string> = {
      "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "&": "&amp;",
    };
    return entities[char] || char;
  });
}
