import { Router, type IRouter } from "express";
import { db, usersTable, dealsTable, badgesTable } from "@workspace/db";
import { eq, and, sql, gte, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/leaderboard", requireAuth, async (req, res, next) => {
  try {
    const me = req.currentUser!;
    const reps = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.role, "rep"))
      .orderBy(desc(usersTable.totalPoints));

    const result = await Promise.all(
      reps.map(async (u, idx) => {
        const stats = await db
          .select({
            cnt: sql<number>`COUNT(*)`,
            rev: sql<number>`COALESCE(SUM(${dealsTable.amount}), 0)`,
          })
          .from(dealsTable)
          .where(and(eq(dealsTable.repId, u.id), sql`${dealsTable.status} IN ('closed','paid')`));
        const badges = await db.select().from(badgesTable).where(eq(badgesTable.userId, u.id));
        return {
          rank: idx + 1,
          userId: u.id,
          name: u.name,
          avatarUrl: u.avatarUrl ?? null,
          totalPoints: u.totalPoints,
          dealsCount: Number(stats[0]?.cnt ?? 0),
          totalRevenue: Number(stats[0]?.rev ?? 0),
          badges: badges.map((b) => ({
            id: b.id,
            userId: b.userId,
            type: b.type,
            label: b.label,
            description: b.description,
            earnedAt: b.earnedAt.toISOString(),
            dealId: b.dealId ?? null,
          })),
          isCurrentUser: u.id === me.id,
        };
      }),
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.get("/leaderboard/summary", requireAuth, async (_req, res, next) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [reps] = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(usersTable)
      .where(eq(usersTable.role, "rep"));
    const [allDeals] = await db
      .select({
        c: sql<number>`COUNT(*)`,
        rev: sql<number>`COALESCE(SUM(${dealsTable.amount}), 0)`,
        pts: sql<number>`COALESCE(SUM(${dealsTable.pointsAwarded}), 0)`,
      })
      .from(dealsTable)
      .where(sql`${dealsTable.status} IN ('closed','paid')`);
    const [monthDeals] = await db
      .select({
        c: sql<number>`COUNT(*)`,
        rev: sql<number>`COALESCE(SUM(${dealsTable.amount}), 0)`,
      })
      .from(dealsTable)
      .where(
        and(sql`${dealsTable.status} IN ('closed','paid')`, gte(dealsTable.closedAt, startOfMonth)),
      );
    const [topRep] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.role, "rep"))
      .orderBy(desc(usersTable.totalPoints))
      .limit(1);
    res.json({
      totalReps: Number(reps?.c ?? 0),
      totalDeals: Number(allDeals?.c ?? 0),
      totalRevenue: Number(allDeals?.rev ?? 0),
      totalPointsAwarded: Number(allDeals?.pts ?? 0),
      topRepName: topRep?.name ?? null,
      topRepPoints: topRep?.totalPoints ?? 0,
      dealsThisMonth: Number(monthDeals?.c ?? 0),
      revenueThisMonth: Number(monthDeals?.rev ?? 0),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
