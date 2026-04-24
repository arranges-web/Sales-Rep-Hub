import { Router, type IRouter } from "express";
import { db, badgesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// Convenience alias: returns the badges for the currently-authenticated rep
// without needing the client to wait on getMe to discover their userId.
// Lets the dashboard fetch profile + badges in parallel on cold load.
router.get("/badges/me", requireAuth, async (req, res, next) => {
  try {
    const me = req.currentUser!;
    const rows = await db
      .select()
      .from(badgesTable)
      .where(eq(badgesTable.userId, me.id))
      .orderBy(desc(badgesTable.earnedAt));
    res.json(
      rows.map((b) => ({
        id: b.id,
        userId: b.userId,
        type: b.type,
        label: b.label,
        description: b.description,
        earnedAt: b.earnedAt.toISOString(),
        dealId: b.dealId ?? null,
      })),
    );
  } catch (e) {
    next(e);
  }
});

router.get("/badges", requireAuth, async (req, res, next) => {
  try {
    const userId = req.query.userId ? Number(req.query.userId) : null;
    const rows = userId
      ? await db.select().from(badgesTable).where(eq(badgesTable.userId, userId)).orderBy(desc(badgesTable.earnedAt))
      : await db.select().from(badgesTable).orderBy(desc(badgesTable.earnedAt));
    res.json(
      rows.map((b) => ({
        id: b.id,
        userId: b.userId,
        type: b.type,
        label: b.label,
        description: b.description,
        earnedAt: b.earnedAt.toISOString(),
        dealId: b.dealId ?? null,
      })),
    );
  } catch (e) {
    next(e);
  }
});

export default router;
