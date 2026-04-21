import { Router, type IRouter } from "express";
import { db, rewardsTable, redemptionsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { recomputeUserPoints } from "../lib/points";

const router: IRouter = Router();

function serR(r: typeof rewardsTable.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    pointCost: r.pointCost,
    category: r.category as "gear" | "pto" | "trip" | "cash" | "other",
    imageUrl: r.imageUrl ?? null,
    available: r.available,
    stock: r.stock ?? null,
  };
}

router.get("/rewards", requireAuth, async (_req, res, next) => {
  try {
    const rows = await db.select().from(rewardsTable);
    res.json(rows.map(serR));
  } catch (e) {
    next(e);
  }
});

router.post("/rewards", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, description, pointCost, category, imageUrl, available, stock } = req.body ?? {};
    const [created] = await db
      .insert(rewardsTable)
      .values({
        name,
        description,
        pointCost,
        category,
        imageUrl: imageUrl ?? null,
        available: available ?? true,
        stock: stock ?? null,
      })
      .returning();
    res.status(201).json(serR(created!));
  } catch (e) {
    next(e);
  }
});

router.patch("/rewards/:rewardId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.rewardId);
    const b = req.body ?? {};
    const [updated] = await db
      .update(rewardsTable)
      .set({
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
        ...(b.pointCost !== undefined ? { pointCost: b.pointCost } : {}),
        ...(b.category !== undefined ? { category: b.category } : {}),
        ...(b.imageUrl !== undefined ? { imageUrl: b.imageUrl } : {}),
        ...(b.available !== undefined ? { available: b.available } : {}),
        ...(b.stock !== undefined ? { stock: b.stock } : {}),
      })
      .where(eq(rewardsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).end();
      return;
    }
    res.json(serR(updated));
  } catch (e) {
    next(e);
  }
});

router.delete("/rewards/:rewardId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.rewardId);
    await db.delete(rewardsTable).where(eq(rewardsTable.id, id));
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

function serRedemption(
  r: typeof redemptionsTable.$inferSelect,
  userName: string,
  rewardName: string,
) {
  return {
    id: r.id,
    userId: r.userId,
    userName,
    rewardId: r.rewardId,
    rewardName,
    pointCost: r.pointCost,
    status: r.status as "pending" | "approved" | "rejected",
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/redemptions", requireAuth, async (req, res, next) => {
  try {
    const me = req.currentUser!;
    const rows = await db
      .select({ r: redemptionsTable, userName: usersTable.name, rewardName: rewardsTable.name })
      .from(redemptionsTable)
      .leftJoin(usersTable, eq(redemptionsTable.userId, usersTable.id))
      .leftJoin(rewardsTable, eq(redemptionsTable.rewardId, rewardsTable.id))
      .orderBy(desc(redemptionsTable.createdAt));
    const filtered = me.role === "admin" ? rows : rows.filter((r) => r.r.userId === me.id);
    res.json(
      filtered.map((row) => serRedemption(row.r, row.userName ?? "Unknown", row.rewardName ?? "Unknown")),
    );
  } catch (e) {
    next(e);
  }
});

router.post("/redemptions", requireAuth, async (req, res, next) => {
  try {
    const me = req.currentUser!;
    const { rewardId } = req.body ?? {};
    const [reward] = await db.select().from(rewardsTable).where(eq(rewardsTable.id, Number(rewardId))).limit(1);
    if (!reward || !reward.available) {
      res.status(400).json({ error: "Reward unavailable" });
      return;
    }
    // me.totalPoints already reflects pending/approved redemptions deducted.
    if (me.totalPoints < reward.pointCost) {
      res.status(400).json({ error: "Not enough points" });
      return;
    }
    const [created] = await db
      .insert(redemptionsTable)
      .values({
        userId: me.id,
        rewardId: reward.id,
        pointCost: reward.pointCost,
        status: "pending",
      })
      .returning();
    // Reserve points immediately so reps can't double-spend on a pending request.
    await recomputeUserPoints(me.id);
    res.status(201).json(serRedemption(created!, me.name, reward.name));
  } catch (e) {
    next(e);
  }
});

router.patch("/redemptions/:redemptionId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.redemptionId);
    const { status } = req.body ?? {};
    const [existing] = await db.select().from(redemptionsTable).where(eq(redemptionsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).end();
      return;
    }
    const [updated] = await db
      .update(redemptionsTable)
      .set({ status })
      .where(eq(redemptionsTable.id, id))
      .returning();
    // Approval keeps points spent; rejection refunds reserved points.
    // recomputeUserPoints subtracts pending+approved, so it always lands at the right balance.
    await recomputeUserPoints(existing.userId);
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, existing.userId)).limit(1);
    const [rw] = await db.select().from(rewardsTable).where(eq(rewardsTable.id, existing.rewardId)).limit(1);
    res.json(serRedemption(updated!, u?.name ?? "Unknown", rw?.name ?? "Unknown"));
  } catch (e) {
    next(e);
  }
});

export default router;
