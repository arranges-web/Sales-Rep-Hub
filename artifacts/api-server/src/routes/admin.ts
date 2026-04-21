import { Router, type IRouter } from "express";
import { db, incentiveTiersTable, pointConfigsTable, trainingResourcesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

// Incentive tiers
function serT(t: typeof incentiveTiersTable.$inferSelect) {
  return {
    id: t.id,
    name: t.name,
    pointThreshold: t.pointThreshold,
    color: t.color,
    description: t.description,
    rewardDescription: t.rewardDescription,
    displayOrder: t.displayOrder,
  };
}
router.get("/incentive-tiers", requireAuth, async (_req, res, next) => {
  try {
    const rows = await db.select().from(incentiveTiersTable).orderBy(asc(incentiveTiersTable.displayOrder));
    res.json(rows.map(serT));
  } catch (e) {
    next(e);
  }
});
router.post("/incentive-tiers", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const [c] = await db.insert(incentiveTiersTable).values(req.body).returning();
    res.status(201).json(serT(c!));
  } catch (e) {
    next(e);
  }
});
router.patch("/incentive-tiers/:tierId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.tierId);
    const [c] = await db.update(incentiveTiersTable).set(req.body).where(eq(incentiveTiersTable.id, id)).returning();
    if (!c) {
      res.status(404).end();
      return;
    }
    res.json(serT(c));
  } catch (e) {
    next(e);
  }
});
router.delete("/incentive-tiers/:tierId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await db.delete(incentiveTiersTable).where(eq(incentiveTiersTable.id, Number(req.params.tierId)));
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// Point configs
function serP(p: typeof pointConfigsTable.$inferSelect) {
  return {
    id: p.id,
    serviceType: p.serviceType as "large_removal" | "trimming_pruning" | "stump_grinding" | "other",
    pointsPer100: p.pointsPer100,
    label: p.label,
  };
}
router.get("/point-configs", requireAuth, async (_req, res, next) => {
  try {
    const rows = await db.select().from(pointConfigsTable);
    res.json(rows.map(serP));
  } catch (e) {
    next(e);
  }
});
router.post("/point-configs", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const [c] = await db.insert(pointConfigsTable).values(req.body).returning();
    res.status(201).json(serP(c!));
  } catch (e) {
    next(e);
  }
});
router.patch("/point-configs/:configId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.configId);
    const [c] = await db.update(pointConfigsTable).set(req.body).where(eq(pointConfigsTable.id, id)).returning();
    if (!c) {
      res.status(404).end();
      return;
    }
    res.json(serP(c));
  } catch (e) {
    next(e);
  }
});
router.delete("/point-configs/:configId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await db.delete(pointConfigsTable).where(eq(pointConfigsTable.id, Number(req.params.configId)));
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// Training resources
function serTR(t: typeof trainingResourcesTable.$inferSelect) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    category: t.category as "sales_script" | "tree_identification" | "product_knowledge" | "objection_handling" | "other",
    contentUrl: t.contentUrl ?? null,
    contentText: t.contentText ?? null,
    thumbnailUrl: t.thumbnailUrl ?? null,
    displayOrder: t.displayOrder,
    createdAt: t.createdAt.toISOString(),
  };
}
router.get("/training", requireAuth, async (_req, res, next) => {
  try {
    const rows = await db.select().from(trainingResourcesTable).orderBy(asc(trainingResourcesTable.displayOrder));
    res.json(rows.map(serTR));
  } catch (e) {
    next(e);
  }
});
router.post("/training", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const [c] = await db.insert(trainingResourcesTable).values(req.body).returning();
    res.status(201).json(serTR(c!));
  } catch (e) {
    next(e);
  }
});
router.patch("/training/:resourceId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.resourceId);
    const [c] = await db.update(trainingResourcesTable).set(req.body).where(eq(trainingResourcesTable.id, id)).returning();
    if (!c) {
      res.status(404).end();
      return;
    }
    res.json(serTR(c));
  } catch (e) {
    next(e);
  }
});
router.delete("/training/:resourceId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await db.delete(trainingResourcesTable).where(eq(trainingResourcesTable.id, Number(req.params.resourceId)));
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
