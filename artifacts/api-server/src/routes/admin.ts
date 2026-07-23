import { Router, type IRouter } from "express";
import { db, incentiveTiersTable, pointConfigsTable, trainingResourcesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { seedBaselineData } from "../lib/seed";
import { previewDemoData, purgeDemoData } from "../lib/demoData";
import { setDemoDataEnabled } from "../lib/settings";

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

// Force-rerun the baseline demo seed. Useful after a schema push that
// cleared rows, or when bringing a fresh environment online without
// restarting the API. Idempotent — uses the same self-healing seeders
// as boot, so real-user data is never clobbered.
router.post(
  "/admin/seed-demo",
  requireAuth,
  requireAdmin,
  async (_req, res, next) => {
    try {
      const t0 = Date.now();
      await seedBaselineData();
      res.json({ ok: true, elapsedMs: Date.now() - t0 });
    } catch (e) {
      next(e);
    }
  },
);

// Dry run for the Go Live card — exactly what a purge would remove.
router.get("/admin/demo-data", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    res.json(await previewDemoData());
  } catch (e) {
    next(e);
  }
});

// Go live: delete the demo cohort and everything attached to it, and flip the
// seeder off for good. Requires an explicit `confirm: "GO LIVE"` in the body
// so a stray POST can't wipe the board.
router.post("/admin/demo-data/purge", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = req.body ?? {};
    if (body.confirm !== "GO LIVE") {
      res.status(400).json({
        error: 'Confirmation required. Send { "confirm": "GO LIVE" }.',
      });
      return;
    }
    const result = await purgeDemoData({
      includeRealRepStarterData: body.includeRealRepStarterData !== false,
      disableDemoData: body.disableDemoData !== false,
    });
    res.json({ ...result, status: await previewDemoData() });
  } catch (e) {
    next(e);
  }
});

// Escape hatch: turn demo seeding back on (e.g. for a training environment).
router.post("/admin/demo-data/enable", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    await setDemoDataEnabled(true);
    await seedBaselineData();
    res.json(await previewDemoData());
  } catch (e) {
    next(e);
  }
});

export default router;
