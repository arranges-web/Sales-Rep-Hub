import { Router, type IRouter } from "express";
import { db, integrationCredentialsTable, pinsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { syncJobberJobs } from "../lib/jobber";

const router: IRouter = Router();

function maskToken(token: string | null | undefined): string | null {
  if (!token) return null;
  if (token.length <= 8) return "••••";
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

async function serializeJobberStatus() {
  const [cred] = await db
    .select()
    .from(integrationCredentialsTable)
    .where(eq(integrationCredentialsTable.provider, "jobber"))
    .limit(1);

  const [pinCount] = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(pinsTable)
    .where(eq(pinsTable.source, "jobber"));

  return {
    provider: "jobber" as const,
    configured: !!cred?.accessToken,
    accountName: cred?.accountName ?? null,
    accessTokenMask: maskToken(cred?.accessToken ?? null),
    lastSyncAt: cred?.lastSyncAt ? cred.lastSyncAt.toISOString() : null,
    lastSyncStatus: cred?.lastSyncStatus ?? null,
    lastSyncError: cred?.lastSyncError ?? null,
    lastSyncJobsCount: cred?.lastSyncJobsCount ?? 0,
    pinsFromJobber: Number(pinCount?.c ?? 0),
  };
}

router.get("/integrations/jobber", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    res.json(await serializeJobberStatus());
  } catch (e) {
    next(e);
  }
});

router.put("/integrations/jobber", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const accessToken =
      typeof body.accessToken === "string" && body.accessToken.trim().length > 0
        ? body.accessToken.trim()
        : null;
    const accountName =
      typeof body.accountName === "string" && body.accountName.trim().length > 0
        ? body.accountName.trim()
        : null;

    const [existing] = await db
      .select()
      .from(integrationCredentialsTable)
      .where(eq(integrationCredentialsTable.provider, "jobber"))
      .limit(1);

    if (existing) {
      await db
        .update(integrationCredentialsTable)
        .set({
          accessToken,
          accountName: accountName ?? existing.accountName,
          updatedAt: new Date(),
        })
        .where(eq(integrationCredentialsTable.id, existing.id));
    } else {
      await db.insert(integrationCredentialsTable).values({
        provider: "jobber",
        accessToken,
        accountName,
      });
    }
    res.json(await serializeJobberStatus());
  } catch (e) {
    next(e);
  }
});

router.post(
  "/integrations/jobber/sync",
  requireAuth,
  requireAdmin,
  async (_req, res, next) => {
    try {
      const result = await syncJobberJobs();
      res.json({
        ...result,
        status: await serializeJobberStatus(),
      });
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/integrations/jobber",
  requireAuth,
  requireAdmin,
  async (_req, res, next) => {
    try {
      await db
        .update(integrationCredentialsTable)
        .set({
          accessToken: null,
          accountName: null,
          updatedAt: new Date(),
        })
        .where(eq(integrationCredentialsTable.provider, "jobber"));
      res.json(await serializeJobberStatus());
    } catch (e) {
      next(e);
    }
  },
);

export default router;
