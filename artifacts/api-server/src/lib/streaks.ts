import { db, dealsTable } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";

export const POINTS_PER_LEVEL = 500;

export function levelInfo(totalPoints: number): {
  level: number;
  nextLevelAt: number;
  pointsThisLevel: number;
  pointsPerLevel: number;
} {
  const safe = Math.max(0, totalPoints);
  const level = Math.floor(safe / POINTS_PER_LEVEL) + 1;
  const nextLevelAt = level * POINTS_PER_LEVEL;
  const pointsThisLevel = safe - (level - 1) * POINTS_PER_LEVEL;
  return { level, nextLevelAt, pointsThisLevel, pointsPerLevel: POINTS_PER_LEVEL };
}

const TZ = "America/New_York";
const DAY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function easternDayOrdinal(d: Date): number {
  const s = DAY_FMT.format(d); // YYYY-MM-DD
  const [y, m, day] = s.split("-").map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, day!) / (24 * 3600 * 1000));
}

export interface StreakInfo {
  currentStreak: number;
  bestStreak: number;
  streakAtRisk: boolean;
}

export async function computeStreaks(userId: number): Promise<StreakInfo> {
  const rows = await db
    .select({ closedAt: dealsTable.closedAt })
    .from(dealsTable)
    .where(
      and(eq(dealsTable.repId, userId), sql`${dealsTable.status} IN ('closed','paid')`),
    );
  if (rows.length === 0) return { currentStreak: 0, bestStreak: 0, streakAtRisk: false };

  const days = new Set<number>();
  for (const r of rows) {
    if (r.closedAt) days.add(easternDayOrdinal(r.closedAt));
  }
  if (days.size === 0) return { currentStreak: 0, bestStreak: 0, streakAtRisk: false };

  const sorted = [...days].sort((a, b) => a - b);
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1]! + 1) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }

  const today = easternDayOrdinal(new Date());
  const last = sorted[sorted.length - 1]!;
  let current = 0;
  if (last === today || last === today - 1) {
    current = 1;
    for (let i = sorted.length - 2; i >= 0; i--) {
      if (sorted[i] === sorted[i + 1]! - 1) current++;
      else break;
    }
  }
  return {
    currentStreak: current,
    bestStreak: Math.max(best, current),
    streakAtRisk: current > 0 && last === today - 1,
  };
}

// Bulk version to avoid N+1 in leaderboard.
export async function computeStreaksForAll(userIds: number[]): Promise<Map<number, StreakInfo>> {
  const out = new Map<number, StreakInfo>();
  if (userIds.length === 0) return out;
  const rows = await db
    .select({ repId: dealsTable.repId, closedAt: dealsTable.closedAt })
    .from(dealsTable)
    .where(
      and(
        inArray(dealsTable.repId, userIds),
        sql`${dealsTable.status} IN ('closed','paid')`,
      ),
    );
  const byUser = new Map<number, Set<number>>();
  for (const r of rows) {
    if (!r.closedAt) continue;
    const ord = easternDayOrdinal(r.closedAt);
    let s = byUser.get(r.repId);
    if (!s) {
      s = new Set();
      byUser.set(r.repId, s);
    }
    s.add(ord);
  }
  const today = easternDayOrdinal(new Date());
  for (const uid of userIds) {
    const days = byUser.get(uid);
    if (!days || days.size === 0) {
      out.set(uid, { currentStreak: 0, bestStreak: 0, streakAtRisk: false });
      continue;
    }
    const sorted = [...days].sort((a, b) => a - b);
    let best = 1;
    let run = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1]! + 1) {
        run++;
        best = Math.max(best, run);
      } else {
        run = 1;
      }
    }
    const last = sorted[sorted.length - 1]!;
    let current = 0;
    if (last === today || last === today - 1) {
      current = 1;
      for (let i = sorted.length - 2; i >= 0; i--) {
        if (sorted[i] === sorted[i + 1]! - 1) current++;
        else break;
      }
    }
    out.set(uid, {
      currentStreak: current,
      bestStreak: Math.max(best, current),
      streakAtRisk: current > 0 && last === today - 1,
    });
  }
  return out;
}
