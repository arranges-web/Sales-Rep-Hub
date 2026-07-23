import {
  db,
  usersTable,
  dealsTable,
  pinsTable,
  badgesTable,
  feedPostsTable,
  commentsTable,
  highFivesTable,
  redemptionsTable,
  campaignsTable,
  campaignStreetsTable,
} from "@workspace/db";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { logger } from "./logger";
import {
  SEED_CLERK_PREFIX,
  DEMO_CAMPAIGNS,
  NEW_REP_STARTER_DEALS,
  NEW_REP_STARTER_PINS,
  NEW_REP_STARTER_PIN_NOTE,
} from "./seed";
import { setDemoDataEnabled, isDemoDataEnabled } from "./settings";

export interface DemoDataCounts {
  mockReps: number;
  deals: number;
  pins: number;
  badges: number;
  feedPosts: number;
  comments: number;
  highFives: number;
  redemptions: number;
  campaigns: number;
  campaignStreets: number;
  /** Starter deals/pins that were handed to *real* reps on first sign-in. */
  starterDealsOnRealReps: number;
  starterPinsOnRealReps: number;
}

export interface DemoDataStatus {
  demoDataEnabled: boolean;
  realUsers: number;
  counts: DemoDataCounts;
}

const STARTER_CUSTOMERS = NEW_REP_STARTER_DEALS.map((d) => d.customer);
const STARTER_ADDRESSES = NEW_REP_STARTER_DEALS.map((d) => d.address);
const STARTER_PIN_ADDRESSES = NEW_REP_STARTER_PINS.map(([addr]) => addr);
const DEMO_CAMPAIGN_NAMES = DEMO_CAMPAIGNS.map((c) => c.name);

async function count(where: Promise<{ c: number }[]>): Promise<number> {
  const rows = await where;
  return Number(rows[0]?.c ?? 0);
}

async function mockRepIds(): Promise<number[]> {
  const rows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(sql`${usersTable.clerkId} LIKE ${SEED_CLERK_PREFIX + "%"}`);
  return rows.map((r) => r.id);
}

/**
 * A starter deal is one whose customer name AND address both come from the
 * canned set. Requiring both means a genuine "Park Family" job at a real
 * address is never mistaken for demo filler.
 */
function starterDealMatch(realRepIds: number[]) {
  return and(
    inArray(dealsTable.repId, realRepIds),
    inArray(dealsTable.customerName, STARTER_CUSTOMERS),
    inArray(dealsTable.address, STARTER_ADDRESSES),
  );
}

/** Same idea for pins: canned address plus the canned note. */
function starterPinMatch(realRepIds: number[]) {
  return and(
    inArray(pinsTable.repId, realRepIds),
    inArray(pinsTable.address, STARTER_PIN_ADDRESSES),
    eq(pinsTable.notes, NEW_REP_STARTER_PIN_NOTE),
    eq(pinsTable.source, "rep"),
  );
}

async function realRepIds(): Promise<number[]> {
  const rows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(sql`${usersTable.clerkId} NOT LIKE ${SEED_CLERK_PREFIX + "%"}`);
  return rows.map((r) => r.id);
}

/** Dry run — exactly what a purge would delete, without deleting anything. */
export async function previewDemoData(): Promise<DemoDataStatus> {
  const mockIds = await mockRepIds();
  const realIds = await realRepIds();

  const zeroIfNoMocks = async (fn: () => Promise<number>) =>
    mockIds.length === 0 ? 0 : fn();

  const counts: DemoDataCounts = {
    mockReps: mockIds.length,
    deals: await zeroIfNoMocks(() =>
      count(
        db
          .select({ c: sql<number>`COUNT(*)` })
          .from(dealsTable)
          .where(inArray(dealsTable.repId, mockIds)),
      ),
    ),
    pins: await zeroIfNoMocks(() =>
      count(
        db
          .select({ c: sql<number>`COUNT(*)` })
          .from(pinsTable)
          .where(inArray(pinsTable.repId, mockIds)),
      ),
    ),
    badges: await zeroIfNoMocks(() =>
      count(
        db
          .select({ c: sql<number>`COUNT(*)` })
          .from(badgesTable)
          .where(inArray(badgesTable.userId, mockIds)),
      ),
    ),
    // Bot posts and author-less posts are demo content regardless of whether
    // the mock cohort still exists.
    feedPosts: await count(
      db
        .select({ c: sql<number>`COUNT(*)` })
        .from(feedPostsTable)
        .where(
          mockIds.length === 0
            ? or(isNull(feedPostsTable.authorId), eq(feedPostsTable.isBot, true))
            : or(
                isNull(feedPostsTable.authorId),
                eq(feedPostsTable.isBot, true),
                inArray(feedPostsTable.authorId, mockIds),
              ),
        ),
    ),
    comments: await zeroIfNoMocks(() =>
      count(
        db
          .select({ c: sql<number>`COUNT(*)` })
          .from(commentsTable)
          .where(inArray(commentsTable.authorId, mockIds)),
      ),
    ),
    highFives: await zeroIfNoMocks(() =>
      count(
        db
          .select({ c: sql<number>`COUNT(*)` })
          .from(highFivesTable)
          .where(inArray(highFivesTable.userId, mockIds)),
      ),
    ),
    redemptions: await zeroIfNoMocks(() =>
      count(
        db
          .select({ c: sql<number>`COUNT(*)` })
          .from(redemptionsTable)
          .where(inArray(redemptionsTable.userId, mockIds)),
      ),
    ),
    campaigns: await count(
      db
        .select({ c: sql<number>`COUNT(*)` })
        .from(campaignsTable)
        .where(inArray(campaignsTable.name, DEMO_CAMPAIGN_NAMES)),
    ),
    campaignStreets: await count(
      db
        .select({ c: sql<number>`COUNT(*)` })
        .from(campaignStreetsTable)
        .where(
          sql`${campaignStreetsTable.campaignId} IN (SELECT ${campaignsTable.id} FROM ${campaignsTable} WHERE ${campaignsTable.name} = ANY(${DEMO_CAMPAIGN_NAMES}))`,
        ),
    ),
    starterDealsOnRealReps:
      realIds.length === 0
        ? 0
        : await count(
            db
              .select({ c: sql<number>`COUNT(*)` })
              .from(dealsTable)
              .where(starterDealMatch(realIds)),
          ),
    starterPinsOnRealReps:
      realIds.length === 0
        ? 0
        : await count(
            db
              .select({ c: sql<number>`COUNT(*)` })
              .from(pinsTable)
              .where(starterPinMatch(realIds)),
          ),
  };

  return {
    demoDataEnabled: await isDemoDataEnabled(),
    realUsers: realIds.length,
    counts,
  };
}

export interface PurgeOptions {
  /**
   * Also strip the canned starter deals/pins that were handed to real reps
   * when they first signed in during the demo period. Defaults to true —
   * these are the rows a real salesperson sees on their own dashboard.
   */
  includeRealRepStarterData?: boolean;
  /** Flip demo mode off so the boot seeder never re-adds any of this. */
  disableDemoData?: boolean;
}

export interface PurgeResult {
  ok: boolean;
  deleted: DemoDataCounts;
  demoDataEnabled: boolean;
  elapsedMs: number;
}

/**
 * Delete every mock rep and everything attached to them. Real users, the
 * reward lineup, incentive tiers, point configs, training resources, and
 * territories are all left alone — those are real configuration.
 *
 * Runs inside a transaction so a failure halfway through can't leave the
 * leaderboard referencing users that no longer exist.
 */
export async function purgeDemoData(opts: PurgeOptions = {}): Promise<PurgeResult> {
  const t0 = Date.now();
  const includeStarter = opts.includeRealRepStarterData !== false;
  const disable = opts.disableDemoData !== false;

  const deleted: DemoDataCounts = {
    mockReps: 0,
    deals: 0,
    pins: 0,
    badges: 0,
    feedPosts: 0,
    comments: 0,
    highFives: 0,
    redemptions: 0,
    campaigns: 0,
    campaignStreets: 0,
    starterDealsOnRealReps: 0,
    starterPinsOnRealReps: 0,
  };

  // Turn the seeder off *before* deleting. If the purge throws partway, the
  // next boot must not helpfully rebuild what we just removed.
  if (disable) await setDemoDataEnabled(false);

  await db.transaction(async (tx) => {
    const mocks = await tx
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(sql`${usersTable.clerkId} LIKE ${SEED_CLERK_PREFIX + "%"}`);
    const mockIds = mocks.map((m) => m.id);

    // Demo feed content: mock-authored, bot, or author-less posts. Their
    // comments and high-fives go with them (including any left by real
    // users — the parent post is disappearing either way).
    const demoPosts = await tx
      .select({ id: feedPostsTable.id })
      .from(feedPostsTable)
      .where(
        mockIds.length === 0
          ? or(isNull(feedPostsTable.authorId), eq(feedPostsTable.isBot, true))
          : or(
              isNull(feedPostsTable.authorId),
              eq(feedPostsTable.isBot, true),
              inArray(feedPostsTable.authorId, mockIds),
            ),
      );
    const demoPostIds = demoPosts.map((p) => p.id);

    if (demoPostIds.length > 0) {
      await tx.delete(commentsTable).where(inArray(commentsTable.postId, demoPostIds));
      await tx.delete(highFivesTable).where(inArray(highFivesTable.postId, demoPostIds));
      const rows = await tx
        .delete(feedPostsTable)
        .where(inArray(feedPostsTable.id, demoPostIds))
        .returning({ id: feedPostsTable.id });
      deleted.feedPosts = rows.length;
    }

    if (mockIds.length > 0) {
      // Mock-authored engagement left on posts that survive (real reps').
      deleted.comments += (
        await tx
          .delete(commentsTable)
          .where(inArray(commentsTable.authorId, mockIds))
          .returning({ id: commentsTable.id })
      ).length;
      deleted.highFives += (
        await tx
          .delete(highFivesTable)
          .where(inArray(highFivesTable.userId, mockIds))
          .returning({ id: highFivesTable.id })
      ).length;
      deleted.redemptions = (
        await tx
          .delete(redemptionsTable)
          .where(inArray(redemptionsTable.userId, mockIds))
          .returning({ id: redemptionsTable.id })
      ).length;
      deleted.badges = (
        await tx
          .delete(badgesTable)
          .where(inArray(badgesTable.userId, mockIds))
          .returning({ id: badgesTable.id })
      ).length;
      deleted.pins = (
        await tx
          .delete(pinsTable)
          .where(inArray(pinsTable.repId, mockIds))
          .returning({ id: pinsTable.id })
      ).length;
      deleted.deals = (
        await tx
          .delete(dealsTable)
          .where(inArray(dealsTable.repId, mockIds))
          .returning({ id: dealsTable.id })
      ).length;

      // Hand any territory or campaign still pointing at a mock rep back to
      // nobody, rather than leaving a dangling id.
      await tx
        .update(campaignStreetsTable)
        .set({ assignedToUserId: null })
        .where(inArray(campaignStreetsTable.assignedToUserId, mockIds));
      await tx
        .update(campaignStreetsTable)
        .set({ completedByUserId: null })
        .where(inArray(campaignStreetsTable.completedByUserId, mockIds));

      deleted.mockReps = (
        await tx
          .delete(usersTable)
          .where(inArray(usersTable.id, mockIds))
          .returning({ id: usersTable.id })
      ).length;
    }

    // Demo campaigns (matched by their canned names) and their streets.
    const demoCampaigns = await tx
      .select({ id: campaignsTable.id })
      .from(campaignsTable)
      .where(inArray(campaignsTable.name, DEMO_CAMPAIGN_NAMES));
    const demoCampaignIds = demoCampaigns.map((c) => c.id);
    if (demoCampaignIds.length > 0) {
      deleted.campaignStreets = (
        await tx
          .delete(campaignStreetsTable)
          .where(inArray(campaignStreetsTable.campaignId, demoCampaignIds))
          .returning({ id: campaignStreetsTable.id })
      ).length;
      deleted.campaigns = (
        await tx
          .delete(campaignsTable)
          .where(inArray(campaignsTable.id, demoCampaignIds))
          .returning({ id: campaignsTable.id })
      ).length;
    }

    // Canned starter rows sitting on real reps' accounts.
    if (includeStarter) {
      const reals = await tx
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(sql`${usersTable.clerkId} NOT LIKE ${SEED_CLERK_PREFIX + "%"}`);
      const realIds = reals.map((r) => r.id);
      if (realIds.length > 0) {
        deleted.starterPinsOnRealReps = (
          await tx
            .delete(pinsTable)
            .where(starterPinMatch(realIds))
            .returning({ id: pinsTable.id })
        ).length;
        const starterDeals = await tx
          .delete(dealsTable)
          .where(starterDealMatch(realIds))
          .returning({ id: dealsTable.id, repId: dealsTable.repId });
        deleted.starterDealsOnRealReps = starterDeals.length;

        // Points were awarded for those closed starter deals — zero out the
        // affected reps so the leaderboard reflects only real work.
        const touched = [...new Set(starterDeals.map((d) => d.repId))];
        for (const repId of touched) {
          await tx.execute(sql`
            UPDATE ${usersTable}
            SET total_points = COALESCE((
              SELECT SUM(${dealsTable.pointsAwarded})
              FROM ${dealsTable}
              WHERE ${dealsTable.repId} = ${repId}
                AND ${dealsTable.status} = 'closed'
            ), 0)
            WHERE ${usersTable.id} = ${repId}
          `);
        }
      }
    }
  });

  logger.info({ deleted, includeStarter, disable }, "Demo data purged");

  return {
    ok: true,
    deleted,
    demoDataEnabled: await isDemoDataEnabled(),
    elapsedMs: Date.now() - t0,
  };
}
