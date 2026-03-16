/**
 * evex-accounts OAuth 2.0 統合レイヤー
 * Authorization Code + PKCE (S256) フローを使用
 *
 * @see https://accounts.evex.land (OAuth 2.0 Authorization Server)
 */
import crypto from "crypto";

const EVEX_URL = process.env.EVEX_ACCOUNTS_URL;
const CLIENT_ID = process.env.EVEX_CLIENT_ID;
const CLIENT_SECRET = process.env.EVEX_CLIENT_SECRET;
const REDIRECT_URI = process.env.EVEX_REDIRECT_URI;

const SCOPES = "openid email profile offline_access discord_id discord_roles";

export interface EvexUser {
  sub: string;
  email: string;
  email_verified?: boolean;
  name: string;
  picture?: string;
  discord_id?: string | null;
  discord_roles?: string[] | null;
}

export function isEvexConfigured(): boolean {
  return !!(EVEX_URL && CLIENT_ID && CLIENT_SECRET);
}

// ==================== PKCE ====================

function base64url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash("sha256").update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

export function generateState(): string {
  return base64url(crypto.randomBytes(32));
}

// ==================== OAuth Endpoints ====================

/**
 * 認可URLを生成
 */
export function getAuthorizationUrl(state: string, codeChallenge: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID!,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${EVEX_URL}/api/oauth/authorize?${params.toString()}`;
}

/**
 * 認可コードをトークンに交換
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken?: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET!,
    code_verifier: codeVerifier,
  });

  const res = await fetch(`${EVEX_URL}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { access_token: string; refresh_token?: string };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
}

/**
 * UserInfo エンドポイントからユーザー情報を取得
 */
export async function fetchUserInfo(accessToken: string): Promise<EvexUser> {
  const res = await fetch(`${EVEX_URL}/api/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`UserInfo failed: ${res.status}`);
  }

  return res.json() as Promise<EvexUser>;
}

/**
 * トークンを失効 (ログアウト時)
 */
export async function revokeEvexToken(token: string): Promise<void> {
  if (!isEvexConfigured()) return;

  const body = new URLSearchParams({
    token,
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET!,
  });

  await fetch(`${EVEX_URL}/api/oauth/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  }).catch(() => {
    // RFC 7009: revoke は常に200を返すが、ネットワークエラーは無視
  });
}
