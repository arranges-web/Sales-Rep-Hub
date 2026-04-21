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

const router: IRouter = Router();

function serializeDeal(d: typeof dealsTable.$inferSelect, repName: string) {
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
  };
}

router.get("/deals", requireAuth, async (req, res, next) => {
  try {
    const repId = req.query.repId ? Number(req.query.repId) : null;
    const status = req.query.status as string | undefined;
    const conditions = [];
    if (repId) conditions.push(eq(dealsTable.repId, repId));
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
    if (isClosed && created) {
      await recomputeUserPoints(u.id);
      await postDealClosedToFeed({
        userId: u.id,
        userName: u.name,
        userAvatarUrl: u.avatarUrl,
        dealId: created.id,
        dealAmount: numericAmount,
        customerName,
        pointsAwarded: points,
      });
      await awardBadgesForClosedDeal({
        userId: u.id,
        userName: u.name,
        userAvatarUrl: u.avatarUrl,
        dealId: created.id,
        dealAmount: numericAmount,
        closedAt: closedAt!,
      });
    }
    res.status(201).json(serializeDeal(created!, u.name));
  } catch (e) {
    next(e);
  }
});

router.get("/deals/:dealId", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.dealId);
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
    await recomputeUserPoints(existing.repId);
    if (justClosed && updated) {
      const [rep] = await db.select().from(usersTable).where(eq(usersTable.id, existing.repId)).limit(1);
      if (rep) {
        await postDealClosedToFeed({
          userId: rep.id,
          userName: rep.name,
          userAvatarUrl: rep.avatarUrl,
          dealId: updated.id,
          dealAmount: newAmount,
          customerName: updated.customerName,
          pointsAwarded,
        });
        await awardBadgesForClosedDeal({
          userId: rep.id,
          userName: rep.name,
          userAvatarUrl: rep.avatarUrl,
          dealId: updated.id,
          dealAmount: newAmount,
          closedAt: closedAt!,
        });
      }
    }
    const [repRow] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, existing.repId)).limit(1);
    res.json(serializeDeal(updated!, repRow?.name ?? "Unknown"));
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
