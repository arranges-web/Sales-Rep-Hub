import { Router, type IRouter } from "express";
import {
  db,
  usersTable,
  territoriesTable,
  dealsTable,
  pinsTable,
  feedPostsTable,
  badgesTable,
  redemptionsTable,
} from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { computeStreaks, computeStreaksForAll, levelInfo } from "../lib/streaks";

const router: IRouter = Router();

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function sanitizeAccent(c: unknown): string | undefined {
  if (typeof c !== "string") return undefined;
  return HEX_RE.test(c) ? c : undefined;
}

interface UserExtras {
  currentStreak: number;
  bestStreak: number;
  streakAtRisk: boolean;
}

function serializeUser(
  u: typeof usersTable.$inferSelect,
  territoryName: string | null = null,
  streak: UserExtras = { currentStreak: 0, bestStreak: 0, streakAtRisk: false },
) {
  const lvl = levelInfo(u.totalPoints);
  return {
    id: u.id,
    clerkId: u.clerkId,
    name: u.name,
    email: u.email,
    role: u.role as "admin" | "rep",
    avatarUrl: u.avatarUrl ?? null,
    accentColor: u.accentColor ?? "#3DA935",
    hometown: u.hometown ?? null,
    bio: u.bio ?? null,
    hawaiiGoal: u.hawaiiGoal ?? null,
    favoriteService: u.favoriteService ?? null,
    totalPoints: u.totalPoints,
    territoryId: u.territoryId ?? null,
    territoryName,
    createdAt: u.createdAt.toISOString(),
    level: lvl.level,
    nextLevelAt: lvl.nextLevelAt,
    pointsThisLevel: lvl.pointsThisLevel,
    pointsPerLevel: lvl.pointsPerLevel,
    currentStreak: streak.currentStreak,
    bestStreak: streak.bestStreak,
    streakAtRisk: streak.streakAtRisk,
  };
}

// Registration + profile creation now lives in POST /api/auth/login. This
// module only serves reads and profile edits for already-authenticated users.

router.get("/users/me", requireAuth, async (req, res, next) => {
  try {
    const u = req.currentUser!;
    let territoryName: string | null = null;
    if (u.territoryId) {
      const [t] = await db
        .select()
        .from(territoriesTable)
        .where(eq(territoriesTable.id, u.territoryId))
        .limit(1);
      territoryName = t?.name ?? null;
    }
    const streak = await computeStreaks(u.id);
    res.json(serializeUser(u, territoryName, streak));
  } catch (e) {
    next(e);
  }
});

router.patch("/users/me", requireAuth, async (req, res, next) => {
  try {
    const u = req.currentUser!;
    const { name, avatarUrl } = req.body ?? {};
    const [updated] = await db
      .update(usersTable)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      })
      .where(eq(usersTable.id, u.id))
      .returning();
    res.json(serializeUser(updated!));
  } catch (e) {
    next(e);
  }
});

router.patch("/users/me/profile", requireAuth, async (req, res, next) => {
  try {
    const u = req.currentUser!;
    const body = req.body ?? {};
    const accent = sanitizeAccent(body.accentColor);
    const trim = (v: unknown) =>
      v === null ? null : typeof v === "string" ? v.slice(0, 500) : undefined;
    const [updated] = await db
      .update(usersTable)
      .set({
        ...(typeof body.name === "string" && body.name.trim()
          ? { name: body.name.trim().slice(0, 120) }
          : {}),
        ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl ?? null } : {}),
        ...(accent ? { accentColor: accent } : {}),
        ...(body.hometown !== undefined ? { hometown: trim(body.hometown) ?? null } : {}),
        ...(body.bio !== undefined ? { bio: trim(body.bio) ?? null } : {}),
        ...(body.hawaiiGoal !== undefined
          ? { hawaiiGoal: trim(body.hawaiiGoal) ?? null }
          : {}),
        ...(body.favoriteService !== undefined
          ? { favoriteService: trim(body.favoriteService) ?? null }
          : {}),
      })
      .where(eq(usersTable.id, u.id))
      .returning();
    res.json(serializeUser(updated!));
  } catch (e) {
    next(e);
  }
});

router.get("/users/me/stats", requireAuth, async (req, res, next) => {
  try {
    const me = req.currentUser!;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [allDeals] = await db
      .select({
        c: sql<number>`COUNT(*)`,
        rev: sql<number>`COALESCE(SUM(${dealsTable.amount}), 0)`,
        pts: sql<number>`COALESCE(SUM(${dealsTable.pointsAwarded}), 0)`,
      })
      .from(dealsTable)
      .where(
        and(eq(dealsTable.repId, me.id), sql`${dealsTable.status} IN ('closed','paid')`),
      );
    const [monthDeals] = await db
      .select({
        c: sql<number>`COUNT(*)`,
        rev: sql<number>`COALESCE(SUM(${dealsTable.amount}), 0)`,
        pts: sql<number>`COALESCE(SUM(${dealsTable.pointsAwarded}), 0)`,
      })
      .from(dealsTable)
      .where(
        and(
          eq(dealsTable.repId, me.id),
          sql`${dealsTable.status} IN ('closed','paid')`,
          gte(dealsTable.closedAt, startOfMonth),
        ),
      );
    const [pins] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        sold: sql<number>`SUM(CASE WHEN ${pinsTable.status} = 'sold' THEN 1 ELSE 0 END)`,
      })
      .from(pinsTable)
      .where(eq(pinsTable.repId, me.id));
    const [feed] = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(feedPostsTable)
      .where(eq(feedPostsTable.authorId, me.id));
    const [badges] = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(badgesTable)
      .where(eq(badgesTable.userId, me.id));
    const [reds] = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(redemptionsTable)
      .where(eq(redemptionsTable.userId, me.id));

    const streak = await computeStreaks(me.id);
    const lvl = levelInfo(me.totalPoints);

    res.json({
      totalPoints: me.totalPoints,
      monthPoints: Number(monthDeals?.pts ?? 0),
      dealsCount: Number(allDeals?.c ?? 0),
      monthDealsCount: Number(monthDeals?.c ?? 0),
      totalRevenue: Number(allDeals?.rev ?? 0),
      monthRevenue: Number(monthDeals?.rev ?? 0),
      pinsCount: Number(pins?.total ?? 0),
      soldPinsCount: Number(pins?.sold ?? 0),
      feedPostsCount: Number(feed?.c ?? 0),
      badgesCount: Number(badges?.c ?? 0),
      redemptionsCount: Number(reds?.c ?? 0),
      currentStreak: streak.currentStreak,
      bestStreak: streak.bestStreak,
      streakAtRisk: streak.streakAtRisk,
      level: lvl.level,
      nextLevelAt: lvl.nextLevelAt,
    });
  } catch (e) {
    next(e);
  }
});

router.get("/users", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        u: usersTable,
        territoryName: territoriesTable.name,
      })
      .from(usersTable)
      .leftJoin(territoriesTable, eq(usersTable.territoryId, territoriesTable.id));
    const streaks = await computeStreaksForAll(rows.map((r) => r.u.id));
    res.json(
      rows.map((r) =>
        serializeUser(
          r.u,
          r.territoryName,
          streaks.get(r.u.id) ?? { currentStreak: 0, bestStreak: 0, streakAtRisk: false },
        ),
      ),
    );
  } catch (e) {
    next(e);
  }
});

router.get("/users/:userId", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.userId);
    const me = req.currentUser!;
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!u) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    let territoryName: string | null = null;
    if (u.territoryId) {
      const [t] = await db
        .select()
        .from(territoriesTable)
        .where(eq(territoriesTable.id, u.territoryId))
        .limit(1);
      territoryName = t?.name ?? null;
    }
    const streak = await computeStreaks(u.id);
    const full = serializeUser(u, territoryName, streak);
    // Admin and the user themselves see the full record (incl. email/clerkId).
    // Other reps see a sanitized public profile only.
    if (me.role === "admin" || me.id === u.id) {
      res.json(full);
      return;
    }
    res.json({ ...full, email: "", clerkId: "" });
  } catch (e) {
    next(e);
  }
});

router.patch("/users/:userId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.userId);
    const {
      name,
      role,
      avatarUrl,
      territoryId,
      accentColor,
      hometown,
      bio,
      hawaiiGoal,
      favoriteService,
    } = req.body ?? {};
    const HEX = /^#[0-9a-fA-F]{6}$/;
    const trim = (v: unknown, max: number): string | null | undefined => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      if (typeof v !== "string") return undefined;
      const t = v.trim();
      return t ? t.slice(0, max) : null;
    };
    const accent =
      accentColor === undefined
        ? undefined
        : accentColor === null
          ? null
          : typeof accentColor === "string" && HEX.test(accentColor)
            ? accentColor
            : undefined;
    const [updated] = await db
      .update(usersTable)
      .set({
        ...(name !== undefined ? { name: String(name).slice(0, 120) } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        ...(territoryId !== undefined ? { territoryId } : {}),
        ...(accent !== undefined ? { accentColor: accent ?? "#3DA935" } : {}),
        ...(hometown !== undefined ? { hometown: trim(hometown, 120) } : {}),
        ...(bio !== undefined ? { bio: trim(bio, 500) } : {}),
        ...(hawaiiGoal !== undefined ? { hawaiiGoal: trim(hawaiiGoal, 200) } : {}),
        ...(favoriteService !== undefined
          ? { favoriteService: trim(favoriteService, 120) }
          : {}),
      })
      .where(eq(usersTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(serializeUser(updated));
  } catch (e) {
    next(e);
  }
});

router.delete("/users/:userId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.userId);
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
