import { Router, type IRouter } from "express";
import { db, dealsTable, usersTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import {
  pointsForDeal,
  recomputeUserPoints,
  awardBadgesForClosedDeal,
  postDealClosedToFeed,
} from "../lib/points";
import { levelInfo } from "../lib/streaks";

const router: IRouter = Router();

interface CelebrationExtras {
  newBadges?: { id: number; type: string; label: string; description: string }[];
  levelBefore?: number;
  levelAfter?: number;
  totalPoints?: number;
}

function serializeDeal(
  d: typeof dealsTable.$inferSelect,
  repName: string,
  extras: CelebrationExtras = {},
) {
  return {
    id: d.id,
    repId: d.repId,
    repName,
    customerName: d.customerName,
    address: d.address,
    serviceType: d.serviceType as "large_removal" | "trimming_pruning" | "stump_grinding" | "other",
    amount: Number(d.amount),
    status: d.status as "lead" | "closed" | "paid",
    pointsAwarded: d.pointsAwarded,
    notes: d.notes ?? null,
    closedAt: d.closedAt ? d.closedAt.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
    newBadges: extras.newBadges ?? [],
    levelBefore: extras.levelBefore ?? null,
    levelAfter: extras.levelAfter ?? null,
    totalPoints: extras.totalPoints ?? null,
  };
}

router.get("/deals", requireAuth, async (req, res, next) => {
  try {
    const me = req.currentUser!;
    const requestedRepId = req.query.repId ? Number(req.query.repId) : null;
    const status = req.query.status as string | undefined;
    const conditions = [];
    // Reps may only see their own deals; admins may filter by repId or see all.
    if (me.role !== "admin") {
      conditions.push(eq(dealsTable.repId, me.id));
    } else if (requestedRepId) {
      conditions.push(eq(dealsTable.repId, requestedRepId));
    }
    if (status) conditions.push(eq(dealsTable.status, status));
    const rows = await db
      .select({ d: dealsTable, repName: usersTable.name })
      .from(dealsTable)
      .leftJoin(usersTable, eq(dealsTable.repId, usersTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(dealsTable.createdAt));
    res.json(rows.map((r) => serializeDeal(r.d, r.repName ?? "Unknown")));
  } catch (e) {
    next(e);
  }
});

router.post("/deals", requireAuth, async (req, res, next) => {
  try {
    const u = req.currentUser!;
    const { customerName, address, serviceType, amount, status, notes } = req.body ?? {};
    const numericAmount = Number(amount);
    const isClosed = status === "closed" || status === "paid";
    const points = isClosed ? await pointsForDeal(serviceType, numericAmount) : 0;
    const closedAt = isClosed ? new Date() : null;
    const [created] = await db
      .insert(dealsTable)
      .values({
        repId: u.id,
        customerName,
        address,
        serviceType,
        amount: numericAmount.toFixed(2),
        status,
        notes: notes ?? null,
        pointsAwarded: points,
        closedAt,
      })
      .returning();
    let extras: CelebrationExtras = {};
    if (isClosed && created) {
      const levelBefore = levelInfo(u.totalPoints).level;
      const totalAfter = await recomputeUserPoints(u.id);
      const levelAfter = levelInfo(totalAfter).level;
      await postDealClosedToFeed({
        userId: u.id,
        userName: u.name,
        userAvatarUrl: u.avatarUrl,
        dealId: created.id,
        dealAmount: numericAmount,
        customerName,
        pointsAwarded: points,
      });
      const newBadges = await awardBadgesForClosedDeal({
        userId: u.id,
        userName: u.name,
        userAvatarUrl: u.avatarUrl,
        dealId: created.id,
        dealAmount: numericAmount,
        closedAt: closedAt!,
      });
      extras = { newBadges, levelBefore, levelAfter, totalPoints: totalAfter };
    }
    res.status(201).json(serializeDeal(created!, u.name, extras));
  } catch (e) {
    next(e);
  }
});

router.get("/deals/:dealId", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.dealId);
    const me = req.currentUser!;
    const [row] = await db
      .select({ d: dealsTable, repName: usersTable.name })
      .from(dealsTable)
      .leftJoin(usersTable, eq(dealsTable.repId, usersTable.id))
      .where(eq(dealsTable.id, id))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (me.role !== "admin" && row.d.repId !== me.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    res.json(serializeDeal(row.d, row.repName ?? "Unknown"));
  } catch (e) {
    next(e);
  }
});

router.patch("/deals/:dealId", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.dealId);
    const u = req.currentUser!;
    const [existing] = await db.select().from(dealsTable).where(eq(dealsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (existing.repId !== u.id && u.role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const body = req.body ?? {};
    const newStatus = body.status ?? existing.status;
    const newAmount = body.amount !== undefined ? Number(body.amount) : Number(existing.amount);
    const newServiceType = body.serviceType ?? existing.serviceType;
    const wasClosed = existing.status === "closed" || existing.status === "paid";
    const isNowClosed = newStatus === "closed" || newStatus === "paid";
    const justClosed = !wasClosed && isNowClosed;
    let pointsAwarded = existing.pointsAwarded;
    let closedAt = existing.closedAt;
    if (justClosed) {
      pointsAwarded = await pointsForDeal(newServiceType, newAmount);
      closedAt = new Date();
    } else if (wasClosed && isNowClosed) {
      pointsAwarded = await pointsForDeal(newServiceType, newAmount);
    } else if (wasClosed && !isNowClosed) {
      pointsAwarded = 0;
      closedAt = null;
    }
    const [updated] = await db
      .update(dealsTable)
      .set({
        ...(body.customerName !== undefined ? { customerName: body.customerName } : {}),
        ...(body.address !== undefined ? { address: body.address } : {}),
        serviceType: newServiceType,
        amount: newAmount.toFixed(2),
        status: newStatus,
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        pointsAwarded,
        closedAt,
      })
      .where(eq(dealsTable.id, id))
      .returning();
    const [repBefore] = await db.select().from(usersTable).where(eq(usersTable.id, existing.repId)).limit(1);
    const levelBefore = repBefore ? levelInfo(repBefore.totalPoints).level : 1;
    const totalAfter = await recomputeUserPoints(existing.repId);
    const levelAfter = levelInfo(totalAfter).level;
    let extras: CelebrationExtras = {
      levelBefore,
      levelAfter,
      totalPoints: totalAfter,
      newBadges: [],
    };
    if (justClosed && updated && repBefore) {
      await postDealClosedToFeed({
        userId: repBefore.id,
        userName: repBefore.name,
        userAvatarUrl: repBefore.avatarUrl,
        dealId: updated.id,
        dealAmount: newAmount,
        customerName: updated.customerName,
        pointsAwarded,
      });
      const newBadges = await awardBadgesForClosedDeal({
        userId: repBefore.id,
        userName: repBefore.name,
        userAvatarUrl: repBefore.avatarUrl,
        dealId: updated.id,
        dealAmount: newAmount,
        closedAt: closedAt!,
      });
      extras = { ...extras, newBadges };
    }
    res.json(serializeDeal(updated!, repBefore?.name ?? "Unknown", extras));
  } catch (e) {
    next(e);
  }
});

router.delete("/deals/:dealId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.dealId);
    const [existing] = await db.select().from(dealsTable).where(eq(dealsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).end();
      return;
    }
    await db.delete(dealsTable).where(eq(dealsTable.id, id));
    await recomputeUserPoints(existing.repId);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
