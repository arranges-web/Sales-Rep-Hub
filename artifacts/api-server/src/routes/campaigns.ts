import { Router, type IRouter } from "express";
import {
  db,
  campaignsTable,
  campaignStreetsTable,
  usersTable,
} from "@workspace/db";
import { eq, desc, sql, inArray, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

type StreetRow = typeof campaignStreetsTable.$inferSelect;

interface CampaignAggregate {
  streetCount: number;
  doneCount: number;
  inProgressCount: number;
  totalDoorsKnocked: number;
  totalFlyersHandedOut: number;
}

const EMPTY_AGG: CampaignAggregate = {
  streetCount: 0,
  doneCount: 0,
  inProgressCount: 0,
  totalDoorsKnocked: 0,
  totalFlyersHandedOut: 0,
};

function serCampaign(
  c: typeof campaignsTable.$inferSelect,
  agg: CampaignAggregate,
  createdByName: string | null,
) {
  return {
    id: c.id,
    name: c.name,
    description: c.description ?? null,
    type: c.type as "door" | "flyer",
    color: c.color,
    status: c.status as "active" | "paused" | "complete",
    createdBy: c.createdBy,
    createdByName,
    createdAt: c.createdAt.toISOString(),
    ...agg,
  };
}

function serStreet(
  s: StreetRow,
  assignedToUserName: string | null,
  completedByUserName: string | null,
) {
  return {
    id: s.id,
    campaignId: s.campaignId,
    name: s.name,
    city: s.city ?? null,
    notes: s.notes ?? null,
    status: s.status as "pending" | "in_progress" | "done" | "skipped",
    assignedToUserId: s.assignedToUserId ?? null,
    assignedToUserName,
    completedByUserId: s.completedByUserId ?? null,
    completedByUserName,
    completedAt: s.completedAt ? s.completedAt.toISOString() : null,
    flyersHandedOut: s.flyersHandedOut,
    doorsKnocked: s.doorsKnocked,
    createdAt: s.createdAt.toISOString(),
  };
}

async function aggregatesFor(
  campaignIds: number[],
): Promise<Map<number, CampaignAggregate>> {
  if (campaignIds.length === 0) return new Map();
  const rows = await db
    .select({
      campaignId: campaignStreetsTable.campaignId,
      total: sql<number>`COUNT(*)`,
      done: sql<number>`SUM(CASE WHEN ${campaignStreetsTable.status} = 'done' THEN 1 ELSE 0 END)`,
      inProgress: sql<number>`SUM(CASE WHEN ${campaignStreetsTable.status} = 'in_progress' THEN 1 ELSE 0 END)`,
      doors: sql<number>`COALESCE(SUM(${campaignStreetsTable.doorsKnocked}), 0)`,
      flyers: sql<number>`COALESCE(SUM(${campaignStreetsTable.flyersHandedOut}), 0)`,
    })
    .from(campaignStreetsTable)
    .where(inArray(campaignStreetsTable.campaignId, campaignIds))
    .groupBy(campaignStreetsTable.campaignId);
  const map = new Map<number, CampaignAggregate>();
  for (const r of rows) {
    map.set(r.campaignId, {
      streetCount: Number(r.total ?? 0),
      doneCount: Number(r.done ?? 0),
      inProgressCount: Number(r.inProgress ?? 0),
      totalDoorsKnocked: Number(r.doors ?? 0),
      totalFlyersHandedOut: Number(r.flyers ?? 0),
    });
  }
  return map;
}

router.get("/campaigns", requireAuth, async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        c: campaignsTable,
        createdByName: usersTable.name,
      })
      .from(campaignsTable)
      .leftJoin(usersTable, eq(campaignsTable.createdBy, usersTable.id))
      .orderBy(desc(campaignsTable.createdAt));
    const ids = rows.map((r) => r.c.id);
    const aggMap = await aggregatesFor(ids);
    res.json(rows.map((r) => serCampaign(r.c, aggMap.get(r.c.id) ?? EMPTY_AGG, r.createdByName ?? null)));
  } catch (e) {
    next(e);
  }
});

router.post("/campaigns", requireAuth, async (req, res, next) => {
  try {
    const me = req.currentUser!;
    const body = req.body ?? {};
    if (typeof body.name !== "string" || !body.name.trim()) {
      res.status(400).json({ error: "name required" });
      return;
    }
    const type = body.type === "flyer" ? "flyer" : "door";
    const color = typeof body.color === "string" && body.color ? body.color : "#3DA935";
    const [created] = await db
      .insert(campaignsTable)
      .values({
        name: body.name.trim(),
        description: typeof body.description === "string" ? body.description : null,
        type,
        color,
        createdBy: me.id,
      })
      .returning();

    if (Array.isArray(body.streets) && body.streets.length > 0) {
      const names = (body.streets as unknown[])
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim());
      if (names.length > 0) {
        await db.insert(campaignStreetsTable).values(
          names.map((name) => ({
            campaignId: created!.id,
            name,
          })),
        );
      }
    }
    const aggMap = await aggregatesFor([created!.id]);
    res.status(201).json(serCampaign(created!, aggMap.get(created!.id) ?? EMPTY_AGG, me.name));
  } catch (e) {
    next(e);
  }
});

router.get("/campaigns/:campaignId", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.campaignId);
    const [row] = await db
      .select({ c: campaignsTable, createdByName: usersTable.name })
      .from(campaignsTable)
      .leftJoin(usersTable, eq(campaignsTable.createdBy, usersTable.id))
      .where(eq(campaignsTable.id, id))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }
    const streets = await db
      .select()
      .from(campaignStreetsTable)
      .where(eq(campaignStreetsTable.campaignId, id))
      .orderBy(campaignStreetsTable.id);

    // Resolve user names for assigned/completed without N+1.
    const userIds = new Set<number>();
    for (const s of streets) {
      if (s.assignedToUserId) userIds.add(s.assignedToUserId);
      if (s.completedByUserId) userIds.add(s.completedByUserId);
    }
    const userMap = new Map<number, string>();
    if (userIds.size > 0) {
      const users = await db
        .select({ id: usersTable.id, name: usersTable.name })
        .from(usersTable)
        .where(inArray(usersTable.id, Array.from(userIds)));
      for (const u of users) userMap.set(u.id, u.name);
    }

    const aggMap = await aggregatesFor([id]);
    const camp = serCampaign(row.c, aggMap.get(id) ?? EMPTY_AGG, row.createdByName ?? null);
    res.json({
      ...camp,
      streets: streets.map((s) =>
        serStreet(
          s,
          s.assignedToUserId ? userMap.get(s.assignedToUserId) ?? null : null,
          s.completedByUserId ? userMap.get(s.completedByUserId) ?? null : null,
        ),
      ),
    });
  } catch (e) {
    next(e);
  }
});

router.patch("/campaigns/:campaignId", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.campaignId);
    const me = req.currentUser!;
    const [existing] = await db
      .select()
      .from(campaignsTable)
      .where(eq(campaignsTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).end();
      return;
    }
    if (existing.createdBy !== me.id && me.role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const body = req.body ?? {};
    const next: Partial<typeof campaignsTable.$inferInsert> = {};
    if (typeof body.name === "string") next.name = body.name;
    if (typeof body.description === "string" || body.description === null)
      next.description = body.description ?? null;
    if (typeof body.color === "string") next.color = body.color;
    if (
      typeof body.status === "string" &&
      ["active", "paused", "complete"].includes(body.status)
    ) {
      next.status = body.status;
    }
    const [updated] = await db
      .update(campaignsTable)
      .set(next)
      .where(eq(campaignsTable.id, id))
      .returning();
    const aggMap = await aggregatesFor([id]);
    const [creator] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, existing.createdBy))
      .limit(1);
    res.json(serCampaign(updated!, aggMap.get(id) ?? EMPTY_AGG, creator?.name ?? null));
  } catch (e) {
    next(e);
  }
});

router.delete("/campaigns/:campaignId", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.campaignId);
    const me = req.currentUser!;
    const [existing] = await db
      .select()
      .from(campaignsTable)
      .where(eq(campaignsTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).end();
      return;
    }
    if (existing.createdBy !== me.id && me.role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    await db.delete(campaignStreetsTable).where(eq(campaignStreetsTable.campaignId, id));
    await db.delete(campaignsTable).where(eq(campaignsTable.id, id));
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

router.post("/campaigns/:campaignId/streets", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.campaignId);
    const body = req.body ?? {};
    const names: string[] = Array.isArray(body.names)
      ? (body.names as unknown[])
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .map((s) => s.trim())
      : [];
    if (names.length === 0) {
      res.status(400).json({ error: "names array required" });
      return;
    }
    const city = typeof body.city === "string" ? body.city : null;
    const inserted = await db
      .insert(campaignStreetsTable)
      .values(names.map((name) => ({ campaignId: id, name, city })))
      .returning();
    res.json(inserted.map((s) => serStreet(s, null, null)));
  } catch (e) {
    next(e);
  }
});

router.patch(
  "/campaigns/:campaignId/streets/:streetId",
  requireAuth,
  async (req, res, next) => {
    try {
      const me = req.currentUser!;
      const campaignId = Number(req.params.campaignId);
      const streetId = Number(req.params.streetId);
      const body = req.body ?? {};

      const [existing] = await db
        .select()
        .from(campaignStreetsTable)
        .where(
          and(
            eq(campaignStreetsTable.id, streetId),
            eq(campaignStreetsTable.campaignId, campaignId),
          ),
        )
        .limit(1);
      if (!existing) {
        res.status(404).end();
        return;
      }

      const next: Partial<typeof campaignStreetsTable.$inferInsert> = {};
      if (
        typeof body.status === "string" &&
        ["pending", "in_progress", "done", "skipped"].includes(body.status)
      ) {
        next.status = body.status;
        if (body.status === "done") {
          next.completedByUserId = me.id;
          next.completedAt = new Date();
        } else if (existing.status === "done") {
          // Walking it back to pending clears the completion fields.
          next.completedByUserId = null;
          next.completedAt = null;
        }
      }
      if (typeof body.notes === "string" || body.notes === null)
        next.notes = body.notes ?? null;
      if (typeof body.flyersHandedOut === "number")
        next.flyersHandedOut = body.flyersHandedOut;
      if (typeof body.doorsKnocked === "number")
        next.doorsKnocked = body.doorsKnocked;
      if (typeof body.assignedToUserId === "number" || body.assignedToUserId === null)
        next.assignedToUserId = body.assignedToUserId ?? null;

      const [updated] = await db
        .update(campaignStreetsTable)
        .set(next)
        .where(eq(campaignStreetsTable.id, streetId))
        .returning();

      // Resolve names for the serialized response.
      const assignedName = updated!.assignedToUserId
        ? (await db
            .select({ name: usersTable.name })
            .from(usersTable)
            .where(eq(usersTable.id, updated!.assignedToUserId))
            .limit(1))[0]?.name ?? null
        : null;
      const completedName = updated!.completedByUserId
        ? (await db
            .select({ name: usersTable.name })
            .from(usersTable)
            .where(eq(usersTable.id, updated!.completedByUserId))
            .limit(1))[0]?.name ?? null
        : null;
      res.json(serStreet(updated!, assignedName, completedName));
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/campaigns/:campaignId/streets/:streetId",
  requireAuth,
  async (req, res, next) => {
    try {
      const campaignId = Number(req.params.campaignId);
      const streetId = Number(req.params.streetId);
      await db
        .delete(campaignStreetsTable)
        .where(
          and(
            eq(campaignStreetsTable.id, streetId),
            eq(campaignStreetsTable.campaignId, campaignId),
          ),
        );
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  },
);

export default router;
