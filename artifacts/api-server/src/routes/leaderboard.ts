import { Router, type IRouter } from "express";
import { db, usersTable, dealsTable, badgesTable } from "@workspace/db";
import { eq, and, sql, gte, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { computeStreaksForAll, levelInfo } from "../lib/streaks";

const router: IRouter = Router();

router.get("/public/pulse", async (_req, res, next) => {
  try {
    res.setHeader("Cache-Control", "public, max-age=30");
    const startOfWeek = new Date();
    const day = startOfWeek.getDay();
    const diff = (day + 6) % 7;
    startOfWeek.setDate(startOfWeek.getDate() - diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const [topRep] = await db
      .select({ name: usersTable.name, totalPoints: usersTable.totalPoints })
      .from(usersTable)
      .where(eq(usersTable.role, "rep"))
      .orderBy(desc(usersTable.totalPoints))
      .limit(1);
    const [reps] = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(usersTable)
      .where(eq(usersTable.role, "rep"));
    const [weekDeals] = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(dealsTable)
      .where(and(sql`${dealsTable.status} IN ('closed','paid')`, gte(dealsTable.closedAt, startOfWeek)));
    const [pool] = await db
      .select({ pts: sql<number>`COALESCE(SUM(${dealsTable.pointsAwarded}), 0)` })
      .from(dealsTable)
      .where(sql`${dealsTable.status} IN ('closed','paid')`);

    res.json({
      topRepFirstName: topRep?.name?.split(" ")[0] ?? null,
      topRepPoints: topRep?.totalPoints ?? 0,
      dealsThisWeek: Number(weekDeals?.c ?? 0),
      totalPointsPool: Number(pool?.pts ?? 0),
      activeReps: Number(reps?.c ?? 0),
    });
  } catch (e) {
    next(e);
  }
});

router.get("/leaderboard", requireAuth, async (req, res, next) => {
  try {
    const me = req.currentUser!;
    const reps = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.role, "rep"))
      .orderBy(desc(usersTable.totalPoints));

    const repIds = reps.map((r) => r.id);
    const streaks = await computeStreaksForAll(repIds);

    // Bulk fetch deal stats and badges to avoid N+1.
    const statsRows = repIds.length
      ? await db
          .select({
            repId: dealsTable.repId,
            cnt: sql<number>`COUNT(*)`,
            rev: sql<number>`COALESCE(SUM(${dealsTable.amount}), 0)`,
          })
          .from(dealsTable)
          .where(
            and(
              inArray(dealsTable.repId, repIds),
              sql`${dealsTable.status} IN ('closed','paid')`,
            ),
          )
          .groupBy(dealsTable.repId)
      : [];
    const statsByRep = new Map(statsRows.map((s) => [s.repId, s]));
    const badgeRows = repIds.length
      ? await db
          .select()
          .from(badgesTable)
          .where(inArray(badgesTable.userId, repIds))
      : [];
    const badgesByUser = new Map<number, typeof badgeRows>();
    for (const b of badgeRows) {
      const arr = badgesByUser.get(b.userId) ?? [];
      arr.push(b);
      badgesByUser.set(b.userId, arr);
    }

    const result = reps.map((u, idx) => {
      const s = statsByRep.get(u.id);
      const badges = badgesByUser.get(u.id) ?? [];
      const lvl = levelInfo(u.totalPoints);
      const streak = streaks.get(u.id) ?? { currentStreak: 0, bestStreak: 0, streakAtRisk: false };
      return {
        rank: idx + 1,
        userId: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl ?? null,
        accentColor: u.accentColor ?? "#2EA3F2",
        hometown: u.hometown ?? null,
        bio: u.bio ?? null,
        hawaiiGoal: u.hawaiiGoal ?? null,
        totalPoints: u.totalPoints,
        dealsCount: Number(s?.cnt ?? 0),
        totalRevenue: Number(s?.rev ?? 0),
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
        level: lvl.level,
        nextLevelAt: lvl.nextLevelAt,
        currentStreak: streak.currentStreak,
        bestStreak: streak.bestStreak,
        streakAtRisk: streak.streakAtRisk,
      };
    });
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
