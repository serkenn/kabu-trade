import { Router } from "express";
import { prisma } from "@kabu-trade/shared";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { generateApiKey, sha256, getClientIp, audit } from "../lib/security.js";
import { apiKeyCreateSchema } from "../lib/validation.js";
import { apiKeyCreateLimiter } from "../middleware/security.js";

export const apiKeysRouter = Router();
apiKeysRouter.use(requireAuth as never);

/** GET /api/apikeys - 自分のAPIキー一覧 */
apiKeysRouter.get("/", async (req: AuthRequest, res) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.user!.id },
      select: {
        id: true, name: true, keyPrefix: true, permissions: true,
        isActive: true, lastUsedAt: true, lastUsedIp: true,
        expiresAt: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(keys);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});

/** POST /api/apikeys - APIキー作成 */
apiKeysRouter.post("/", apiKeyCreateLimiter, async (req: AuthRequest, res) => {
  try {
    const parsed = apiKeyCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { name, permissions, expiresInDays } = parsed.data;

    const existingCount = await prisma.apiKey.count({
      where: { userId: req.user!.id },
    });
    if (existingCount >= 10) {
      return res.status(400).json({ error: "APIキーは最大10個までです" });
    }

    // 暗号論的に安全なキー生成
    const rawKey = generateApiKey();
    const keyHash = sha256(rawKey);
    const keyPrefix = rawKey.slice(0, 11) + "..." + rawKey.slice(-4);

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: req.user!.id,
        name,
        keyHash,      // ハッシュのみ保存
        keyPrefix,    // 表示用プレフィックス
        permissions,
        expiresAt,
      },
    });

    const ip = getClientIp(req);
    await audit(
      req.user!.id, "API_KEY_CREATED", `apikey:${apiKey.id}`,
      `name=${name}, permissions=[${permissions}]`, ip, req.headers["user-agent"] || ""
    );

    // 作成時のみフルキーを返す（以降は取得不可能）
    res.status(201).json({
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey,
      keyPrefix,
      permissions: apiKey.permissions,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      warning: "このAPIキーは一度しか表示されません。安全な場所に保存してください。",
    });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});

/** DELETE /api/apikeys/:id - APIキー削除 */
apiKeysRouter.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!apiKey) {
      return res.status(404).json({ error: "API key not found" });
    }

    await prisma.apiKey.delete({ where: { id: apiKey.id } });

    const ip = getClientIp(req);
    await audit(
      req.user!.id, "API_KEY_DELETED", `apikey:${apiKey.id}`,
      `name=${apiKey.name}`, ip, req.headers["user-agent"] || ""
    );

    res.json({ ok: true });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});

/** PATCH /api/apikeys/:id - APIキー更新 */
apiKeysRouter.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!apiKey) {
      return res.status(404).json({ error: "API key not found" });
    }

    const updated = await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: {
        isActive: req.body.isActive ?? apiKey.isActive,
        name: req.body.name ?? apiKey.name,
        permissions: req.body.permissions ?? apiKey.permissions,
      },
    });

    const ip = getClientIp(req);
    await audit(
      req.user!.id, "API_KEY_UPDATED", `apikey:${apiKey.id}`,
      `isActive=${updated.isActive}`, ip, req.headers["user-agent"] || ""
    );

    res.json({
      id: updated.id,
      name: updated.name,
      keyPrefix: updated.keyPrefix,
      permissions: updated.permissions,
      isActive: updated.isActive,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error" });
  }
});
