import { Router, type IRouter } from "express";
import { db, badgesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

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
