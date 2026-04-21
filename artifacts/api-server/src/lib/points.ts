import { db, dealsTable, pointConfigsTable, usersTable, badgesTable, feedPostsTable, redemptionsTable } from "@workspace/db";
import { eq, and, sql, gte, lte } from "drizzle-orm";

const DEFAULT_POINTS_PER_100 = 10;

export async function pointsForDeal(serviceType: string, amount: number): Promise<number> {
  const [cfg] = await db
    .select()
    .from(pointConfigsTable)
    .where(eq(pointConfigsTable.serviceType, serviceType))
    .limit(1);
  const per100 = cfg?.pointsPer100 ?? DEFAULT_POINTS_PER_100;
  return Math.floor((amount / 100) * per100);
}

// Returns the user's spendable balance: closed-deal points minus
// points reserved by pending or already-approved redemptions.
export async function recomputeUserPoints(userId: number): Promise<number> {
  const earnedRows = await db
    .select({ total: sql<number>`COALESCE(SUM(${dealsTable.pointsAwarded}), 0)` })
    .from(dealsTable)
    .where(and(eq(dealsTable.repId, userId), sql`${dealsTable.status} IN ('closed','paid')`));
  const spentRows = await db
    .select({ total: sql<number>`COALESCE(SUM(${redemptionsTable.pointCost}), 0)` })
    .from(redemptionsTable)
    .where(and(eq(redemptionsTable.userId, userId), sql`${redemptionsTable.status} IN ('pending','approved')`));
  const earned = Number(earnedRows[0]?.total ?? 0);
  const spent = Number(spentRows[0]?.total ?? 0);
  const total = Math.max(0, earned - spent);
  await db.update(usersTable).set({ totalPoints: total }).where(eq(usersTable.id, userId));
  return total;
}

export async function awardBadgesForClosedDeal(opts: {
  userId: number;
  userName: string;
  userAvatarUrl: string | null;
  dealId: number;
  dealAmount: number;
  closedAt: Date;
}) {
  const { userId, userName, userAvatarUrl, dealId, dealAmount, closedAt } = opts;
  const newBadges: { type: string; label: string; description: string }[] = [];

  // First Deal
  const existingDeals = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(dealsTable)
    .where(and(eq(dealsTable.repId, userId), sql`${dealsTable.status} IN ('closed','paid')`));
  if (Number(existingDeals[0]?.count ?? 0) === 1) {
    const [exists] = await db
      .select()
      .from(badgesTable)
      .where(and(eq(badgesTable.userId, userId), eq(badgesTable.type, "first_deal")))
      .limit(1);
    if (!exists) {
      newBadges.push({
        type: "first_deal",
        label: "First Deal",
        description: "Closed your first deal — welcome to the team!",
      });
    }
  }

  // Century Club: deal of $10k+
  if (dealAmount >= 10000) {
    newBadges.push({
      type: "century_club",
      label: "Century Club",
      description: `Closed a deal of $${dealAmount.toLocaleString()} or more.`,
    });
  }

  // Hat Trick: 3 closed deals in same day
  const startOfDay = new Date(closedAt);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(closedAt);
  endOfDay.setHours(23, 59, 59, 999);
  const dayDeals = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(dealsTable)
    .where(
      and(
        eq(dealsTable.repId, userId),
        sql`${dealsTable.status} IN ('closed','paid')`,
        gte(dealsTable.closedAt, startOfDay),
        lte(dealsTable.closedAt, endOfDay),
      ),
    );
  if (Number(dayDeals[0]?.count ?? 0) >= 3) {
    const [exists] = await db
      .select()
      .from(badgesTable)
      .where(
        and(
          eq(badgesTable.userId, userId),
          eq(badgesTable.type, "hat_trick"),
          gte(badgesTable.earnedAt, startOfDay),
          lte(badgesTable.earnedAt, endOfDay),
        ),
      )
      .limit(1);
    if (!exists) {
      newBadges.push({
        type: "hat_trick",
        label: "Hat Trick",
        description: "Closed 3 deals in a single day. Unstoppable!",
      });
    }
  }

  const inserted: { id: number; type: string; label: string; description: string }[] = [];
  for (const b of newBadges) {
    const [row] = await db
      .insert(badgesTable)
      .values({
        userId,
        type: b.type,
        label: b.label,
        description: b.description,
        dealId,
      })
      .returning();
    if (row) inserted.push({ id: row.id, type: b.type, label: b.label, description: b.description });
    await db.insert(feedPostsTable).values({
      authorId: null,
      authorName: "Joshua Tree Bot",
      authorAvatarUrl: null,
      content: `${userName} just earned the ${b.label} badge! ${b.description}`,
      isBot: true,
      dealId,
    });
  }

  return inserted;
}

export async function postDealClosedToFeed(opts: {
  userId: number;
  userName: string;
  userAvatarUrl: string | null;
  dealId: number;
  dealAmount: number;
  customerName: string;
  pointsAwarded: number;
}) {
  await db.insert(feedPostsTable).values({
    authorId: null,
    authorName: "Joshua Tree Bot",
    authorAvatarUrl: null,
    content: `🌳 ${opts.userName} just closed a $${opts.dealAmount.toLocaleString()} deal with ${opts.customerName} — earned ${opts.pointsAwarded} points!`,
    isBot: true,
    dealId: opts.dealId,
  });
}
