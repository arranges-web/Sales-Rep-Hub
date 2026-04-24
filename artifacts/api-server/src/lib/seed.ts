import {
  db,
  usersTable,
  territoriesTable,
  pointConfigsTable,
  incentiveTiersTable,
  rewardsTable,
  trainingResourcesTable,
  dealsTable,
  pinsTable,
  feedPostsTable,
  badgesTable,
  commentsTable,
  highFivesTable,
  redemptionsTable,
} from "@workspace/db";
import { sql, eq, and, inArray, notInArray, desc, or, isNull } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { logger } from "./logger";
import { pointsForDeal, recomputeUserPoints } from "./points";

const SEED_CLERK_PREFIX = "seed_mock_";

// Number of mock reps that the demo expects to be live. If fewer exist,
// the seed self-heals on startup so the launch experience never feels empty.
const EXPECTED_MOCK_REPS = 25;

// Reward names that ship with the new (masculine) prize lineup. Used to
// detect a database that still has the old AirPods/Sanibel-era rewards
// so we can swap it for the current set on the next server boot.
const CURRENT_REWARD_NAMES = new Set([
  "JT Logo Hoodie",
  "Yeti Tumbler (30oz)",
  "JBL Charge 5 Speaker",
  "Nike Footwear Voucher",
  "DeWalt 20V Drill Combo",
  "Bucs / Lightning Tickets",
  "Bonus PTO Day",
  "Traeger Pro 575 Grill",
  "PlayStation 5 Bundle",
  "Inshore Fishing Charter",
  "Top-Golf Bay (4 Hours)",
  "$500 Visa Gift Card",
  "Ford F-150 Lease (3 mo)",
  "Hawaii Trip for Two",
]);

const ACCENTS = ["#2EA3F2", "#2C8214", "#FFBF00", "#9333ea", "#ec4899", "#f97316", "#0ea5e9", "#14b8a6"];
const HOMETOWNS = ["Cape Coral, FL", "Fort Myers, FL", "Naples, FL", "Bonita Springs, FL", "Estero, FL", "Sanibel, FL", "Punta Gorda, FL"];

const MOCK_REPS = [
  { name: "Marcus Reyes",     email: "marcus@joshuatree.local",   avatar: "https://i.pravatar.cc/150?img=12" },
  { name: "Tasha Williams",   email: "tasha@joshuatree.local",    avatar: "https://i.pravatar.cc/150?img=47" },
  { name: "Diego Alvarez",    email: "diego@joshuatree.local",    avatar: "https://i.pravatar.cc/150?img=33" },
  { name: "Priya Patel",      email: "priya@joshuatree.local",    avatar: "https://i.pravatar.cc/150?img=45" },
  { name: "Brandon Cole",     email: "brandon@joshuatree.local",  avatar: "https://i.pravatar.cc/150?img=59" },
  { name: "Aisha Brooks",     email: "aisha@joshuatree.local",    avatar: "https://i.pravatar.cc/150?img=49" },
  { name: "Ryan O'Connell",   email: "ryan@joshuatree.local",     avatar: "https://i.pravatar.cc/150?img=15" },
  { name: "Sofia Mendez",     email: "sofia@joshuatree.local",    avatar: "https://i.pravatar.cc/150?img=44" },
  { name: "Chris Doolittle",  email: "chris@joshuatree.local",    avatar: "https://i.pravatar.cc/150?img=22" },
  { name: "Jamal Foster",     email: "jamal@joshuatree.local",    avatar: "https://i.pravatar.cc/150?img=68" },
  { name: "Hannah Lin",       email: "hannah@joshuatree.local",   avatar: "https://i.pravatar.cc/150?img=23" },
  { name: "Nico Rivera",      email: "nico@joshuatree.local",     avatar: "https://i.pravatar.cc/150?img=53" },
  { name: "Maya Patterson",   email: "maya@joshuatree.local",     avatar: "https://i.pravatar.cc/150?img=48" },
  { name: "Owen Castillo",    email: "owen@joshuatree.local",     avatar: "https://i.pravatar.cc/150?img=11" },
  { name: "Lila Nakamura",    email: "lila@joshuatree.local",     avatar: "https://i.pravatar.cc/150?img=24" },
  { name: "DeShawn Hayes",    email: "deshawn@joshuatree.local",  avatar: "https://i.pravatar.cc/150?img=65" },
  { name: "Quinn Bauer",      email: "quinn@joshuatree.local",    avatar: "https://i.pravatar.cc/150?img=14" },
  { name: "Camila Soto",      email: "camila@joshuatree.local",   avatar: "https://i.pravatar.cc/150?img=46" },
  { name: "Elena Petrova",    email: "elena@joshuatree.local",    avatar: "https://i.pravatar.cc/150?img=25" },
  { name: "Tyler McCabe",     email: "tyler@joshuatree.local",    avatar: "https://i.pravatar.cc/150?img=58" },
  { name: "Isabella Costa",   email: "isabella@joshuatree.local", avatar: "https://i.pravatar.cc/150?img=26" },
  { name: "Wesley Park",      email: "wesley@joshuatree.local",   avatar: "https://i.pravatar.cc/150?img=13" },
  { name: "Naomi Adeyemi",    email: "naomi@joshuatree.local",    avatar: "https://i.pravatar.cc/150?img=27" },
  { name: "Felix Brennan",    email: "felix@joshuatree.local",    avatar: "https://i.pravatar.cc/150?img=51" },
  { name: "Aria Khoury",      email: "aria@joshuatree.local",     avatar: "https://i.pravatar.cc/150?img=28" },
];

const PIN_PHOTOS = [
  "https://images.unsplash.com/photo-1444392061186-9fc38f84f726?w=600",
  "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=600",
  "https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=600",
  "https://images.unsplash.com/photo-1546587348-d12660c30c50?w=600",
];

const SWFL_ADDRESSES = [
  ["1432 Coral Ridge Dr, Cape Coral FL", 26.6406, -82.0123],
  ["784 Hibiscus Ln, Fort Myers FL",     26.6196, -81.8762],
  ["219 Banyan Blvd, Naples FL",         26.1420, -81.7948],
  ["3015 Surfside Pkwy, Cape Coral FL",  26.5870, -82.0231],
  ["88 Sandpiper Ct, Bonita Springs FL", 26.3398, -81.7787],
  ["507 Royal Palm Way, Fort Myers FL",  26.6312, -81.8542],
  ["1620 Mariner Dr, Sanibel FL",        26.4499, -82.0353],
  ["304 SE 22nd Ave, Cape Coral FL",     26.6312, -81.9742],
  ["910 Heron Cove, Estero FL",          26.4380, -81.8068],
  ["66 Magnolia Cir, Fort Myers FL",     26.6450, -81.8420],
  ["1188 Beachview Dr, Fort Myers FL",   26.4525, -81.9580],
  ["3200 Periwinkle Way, Sanibel FL",    26.4490, -82.0165],
  ["742 Cypress Lake Dr, Fort Myers FL", 26.5470, -81.8770],
  ["55 Pine Island Rd, Cape Coral FL",   26.6800, -81.9990],
  ["1900 Gulf Shore Blvd, Naples FL",    26.1500, -81.8120],
  ["812 Mangrove Pl, Bonita Springs FL", 26.3415, -81.7920],
  ["1101 Live Oak Ln, Fort Myers FL",    26.6150, -81.8860],
  ["451 Tarpon St, Cape Coral FL",       26.5990, -82.0000],
  ["999 Bayfront Pkwy, Naples FL",       26.1380, -81.7910],
  ["77 Coconut Dr, Fort Myers FL",       26.6300, -81.8650],
  ["230 Sea Grape Way, Sanibel FL",      26.4470, -82.0270],
  ["1455 Estero Blvd, Fort Myers Beach", 26.4485, -81.9540],
  ["1003 Riverside Dr, Fort Myers FL",   26.6500, -81.8700],
  ["520 Coconut Cir, Cape Coral FL",     26.5950, -81.9810],
  ["88 Bayshore Dr, Bonita Springs FL",  26.3360, -81.7840],
  ["202 Old US 41, Estero FL",           26.4450, -81.8060],
  ["1320 Pelican Bay Blvd, Naples FL",   26.2150, -81.8160],
  ["411 Manatee Ln, Cape Coral FL",      26.6700, -82.0050],
  ["77 Dune Cir, Fort Myers Beach FL",   26.4520, -81.9510],
  ["688 Sabal Palm Dr, Fort Myers FL",   26.6080, -81.8790],
  ["3125 Pinewood Cir, Cape Coral FL",   26.6500, -82.0150],
  ["921 Sea Oats Ct, Sanibel FL",        26.4530, -82.0290],
  ["55 Whispering Pines Dr, Naples FL",  26.1810, -81.7920],
  ["1407 Gladiolus Dr, Fort Myers FL",   26.5610, -81.8930],
  ["244 Driftwood Ln, Bonita Springs",   26.3450, -81.7870],
  ["1801 Skyline Dr, Cape Coral FL",     26.6020, -81.9970],
  ["377 Mangrove Pkwy, Naples FL",       26.1610, -81.7990],
  ["888 Hammock Ln, Fort Myers FL",      26.6240, -81.8490],
];

const SERVICE_TYPES = ["large_removal", "trimming_pruning", "stump_grinding", "other"] as const;
type ServiceType = (typeof SERVICE_TYPES)[number];

const DEAL_NOTES: Record<ServiceType, string[]> = {
  large_removal: [
    "Massive oak leaning over the pool — full removal + cleanup.",
    "Storm-damaged ficus, owner wants it gone before hurricane season.",
    "Two large palms removed, stump grinding included.",
  ],
  trimming_pruning: [
    "Annual maintenance trim for backyard trees.",
    "Lift canopy away from roofline, clean deadwood.",
    "Hedge shaping along front driveway.",
  ],
  stump_grinding: [
    "Three stumps from previous removal, grind below grade.",
    "Single large oak stump, grind and haul.",
  ],
  other: [
    "Lot-clearing prep for new fence install.",
    "Emergency limb removal after storm.",
    "Cabling and bracing for heritage banyan.",
  ],
};

const PIN_NOTES = [
  "Owner home — interested in trimming next month.",
  "Large dead limb hanging over driveway.",
  "Asked us to come back Saturday morning.",
  "Spoke with husband, wife handles decisions.",
  "Quote sent — follow up Friday.",
  "Sold! Crew scheduled next Tuesday.",
  null,
  null,
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]!;
}

function rand(seed: number): number {
  // tiny deterministic PRNG
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

async function isEmpty(table: PgTable): Promise<boolean> {
  const rows = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(table);
  return Number(rows[0]?.c ?? 0) === 0;
}

export async function seedBaselineData(): Promise<void> {
  try {
    await seedTerritories();
    await backfillTerritoryBounds();
    await seedPointConfigs();
    await seedIncentiveTiers();
    await restockRewardsIfStale();
    await restockTrainingIfStale();
    await healMockRepsIfStale();
    await seedFeedSocialSignals();
    await seedDemoRedemptions();
  } catch (err) {
    logger.error({ err }, "Seed failed");
  }
}

// True once any non-mock (real Clerk) user has signed up. Once this flips
// true the destructive self-heal paths below downgrade to additive-only
// mode so we never clobber real activity.
async function hasRealUsers(): Promise<boolean> {
  const rows = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(usersTable)
    .where(sql`${usersTable.clerkId} NOT LIKE ${SEED_CLERK_PREFIX + "%"}`);
  return Number(rows[0]?.c ?? 0) > 0;
}

// Insert any rewards from the current lineup that aren't already present
// (matched by name). Strictly additive — never deletes existing rewards
// or redemptions.
async function insertMissingCurrentRewards(): Promise<void> {
  const existing = await db.select({ name: rewardsTable.name }).from(rewardsTable);
  const have = new Set(existing.map((r) => r.name));
  const missing = [...CURRENT_REWARD_NAMES].filter((n) => !have.has(n));
  if (missing.length === 0) return;
  logger.info({ added: missing.length }, "Adding missing rewards from current lineup");
  await seedRewards(missing);
}

// Reward self-heal:
//  - Empty table: full seed.
//  - All current names present: no-op.
//  - Real users exist OR any redemptions exist: additive only (never
//    delete). Just insert any missing current-lineup rewards.
//  - Demo-only environment with stale-only lineup: replace.
async function restockRewardsIfStale(): Promise<void> {
  const rows = await db.select({ name: rewardsTable.name }).from(rewardsTable);
  if (rows.length === 0) {
    await seedRewards();
    return;
  }
  const allCurrent = rows.every((r) => CURRENT_REWARD_NAMES.has(r.name));
  if (allCurrent && rows.length >= CURRENT_REWARD_NAMES.size) return;

  const [redemptionRow] = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(redemptionsTable);
  const hasRedemptions = Number(redemptionRow?.c ?? 0) > 0;
  if (hasRedemptions || (await hasRealUsers())) {
    await insertMissingCurrentRewards();
    // Mark non-canonical rewards as unavailable so the vault stops
    // surfacing stale legacy items, while preserving the rows (and
    // their FK references from redemption history).
    const canonical = Array.from(CURRENT_REWARD_NAMES);
    const stale = await db
      .update(rewardsTable)
      .set({ available: false })
      .where(and(notInArray(rewardsTable.name, canonical), eq(rewardsTable.available, true)))
      .returning({ id: rewardsTable.id });
    if (stale.length > 0) {
      logger.info({ count: stale.length }, "Marked stale legacy rewards unavailable");
    }
    return;
  }

  logger.info({ before: rows.length }, "Replacing stale reward lineup (demo-only env)");
  await db.delete(redemptionsTable);
  await db.delete(rewardsTable);
  await seedRewards();
}

// Training self-heal: strictly additive — insert any canonical training
// rows whose title isn't already present. Never deletes admin content.
async function restockTrainingIfStale(): Promise<void> {
  const existing = await db
    .select({ title: trainingResourcesTable.title })
    .from(trainingResourcesTable);
  const have = new Set(existing.map((r) => r.title));
  // Probe canonical titles by inserting via seedTrainingResources, which
  // is itself empty-guarded. Use a no-op fast path when the table looks
  // healthy enough.
  if (existing.length === 0) {
    await seedTrainingResources();
    return;
  }
  await seedMissingTrainingResources(have);
}

// If we're missing mock reps (fresh install OR an older partial seed),
// wipe the seed_mock_* cohort and the demo activity attached to it, then
// reseed. Real users and any data they own/touched are preserved:
//  - Mock posts (mock-authored, bot, or NULL-author) that have ANY real
//    user dependency (comment or high-five from a non-mock user) are
//    kept intact. Everything else mock-owned is dropped.
//  - Mock-authored comments/high-fives on real-user posts are dropped
//    (those are demo activity attached to mock reps).
//  - Real users' deals/pins/badges/redemptions are never touched.
async function healMockRepsIfStale(): Promise<void> {
  const mocks = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(sql`${usersTable.clerkId} LIKE ${SEED_CLERK_PREFIX + "%"}`);
  if (mocks.length >= EXPECTED_MOCK_REPS) return;

  if (mocks.length > 0) {
    const mockIds = mocks.map((m) => m.id);
    logger.info(
      { existing: mocks.length, expected: EXPECTED_MOCK_REPS },
      "Mock rep cohort is incomplete — wiping and reseeding",
    );

    // All posts that are demo content: mock-rep-authored OR bot OR
    // NULL-author. Real-user-authored posts are excluded.
    const mockPostRows = await db
      .select({ id: feedPostsTable.id })
      .from(feedPostsTable)
      .where(
        or(
          isNull(feedPostsTable.authorId),
          eq(feedPostsTable.isBot, true),
          inArray(feedPostsTable.authorId, mockIds),
        ),
      );
    const mockPostIds = mockPostRows.map((r) => r.id);

    // Of those demo posts, find the ones that have at least one real-user
    // (non-mock) interaction — those we must preserve so we never delete
    // a real user's comment/high-five.
    const protectedPostIds = new Set<number>();
    if (mockPostIds.length > 0) {
      const protectedFromComments = await db
        .selectDistinct({ postId: commentsTable.postId })
        .from(commentsTable)
        .innerJoin(usersTable, eq(commentsTable.authorId, usersTable.id))
        .where(
          and(
            inArray(commentsTable.postId, mockPostIds),
            sql`${usersTable.clerkId} NOT LIKE ${SEED_CLERK_PREFIX + "%"}`,
          ),
        );
      for (const r of protectedFromComments) protectedPostIds.add(r.postId);
      const protectedFromHighFives = await db
        .selectDistinct({ postId: highFivesTable.postId })
        .from(highFivesTable)
        .innerJoin(usersTable, eq(highFivesTable.userId, usersTable.id))
        .where(
          and(
            inArray(highFivesTable.postId, mockPostIds),
            sql`${usersTable.clerkId} NOT LIKE ${SEED_CLERK_PREFIX + "%"}`,
          ),
        );
      for (const r of protectedFromHighFives) protectedPostIds.add(r.postId);
    }
    const wipeablePostIds = mockPostIds.filter((id) => !protectedPostIds.has(id));

    // Drop dependents on the wipeable demo posts (these dependents are
    // guaranteed to be mock-owned by definition of "wipeable").
    if (wipeablePostIds.length > 0) {
      await db.delete(commentsTable).where(inArray(commentsTable.postId, wipeablePostIds));
      await db.delete(highFivesTable).where(inArray(highFivesTable.postId, wipeablePostIds));
    }
    // Drop mock-rep activity that lives on real-user (or protected demo)
    // posts — these are explicitly "demo activity attached to mock reps".
    await db.delete(commentsTable).where(inArray(commentsTable.authorId, mockIds));
    await db.delete(highFivesTable).where(inArray(highFivesTable.userId, mockIds));
    await db.delete(redemptionsTable).where(inArray(redemptionsTable.userId, mockIds));
    await db.delete(badgesTable).where(inArray(badgesTable.userId, mockIds));
    await db.delete(pinsTable).where(inArray(pinsTable.repId, mockIds));
    await db.delete(dealsTable).where(inArray(dealsTable.repId, mockIds));
    if (wipeablePostIds.length > 0) {
      await db.delete(feedPostsTable).where(inArray(feedPostsTable.id, wipeablePostIds));
    }
    if (protectedPostIds.size > 0) {
      logger.info(
        { preserved: protectedPostIds.size },
        "Preserved demo posts that have real-user interactions",
      );
    }
    await db
      .delete(usersTable)
      .where(sql`${usersTable.clerkId} LIKE ${SEED_CLERK_PREFIX + "%"}`);
  }

  await seedMockRepsAndActivity();
}

// Approximate GeoJSON polygons covering the four SWFL routes. These are
// rough cuts good enough to render meaningfully on the leaflet map; admins
// can redraw them from the Territories tab.
function geoPolygon(rect: [[number, number], [number, number]]): string {
  // rect = [[south, west], [north, east]] — produces a closed 5-point poly
  const [[s, w], [n, e]] = rect;
  return JSON.stringify({
    type: "Polygon",
    coordinates: [[
      [w, s],
      [e, s],
      [e, n],
      [w, n],
      [w, s],
    ]],
  });
}

const TERRITORY_SEED = [
  {
    name: "Cape Coral",
    color: "#2EA3F2",
    description: "Cape Coral & surrounding canals",
    bounds: geoPolygon([[26.5500, -82.0500], [26.7100, -81.9700]]),
  },
  {
    name: "Fort Myers",
    color: "#2C8214",
    description: "Downtown Fort Myers & River District",
    bounds: geoPolygon([[26.5500, -81.9200], [26.7000, -81.8200]]),
  },
  {
    name: "Naples",
    color: "#FFBF00",
    description: "Naples & Pelican Bay",
    bounds: geoPolygon([[26.0900, -81.8300], [26.2500, -81.7500]]),
  },
  {
    name: "Bonita / Estero",
    color: "#9333ea",
    description: "Bonita Springs & Estero corridor",
    bounds: geoPolygon([[26.3100, -81.8400], [26.4700, -81.7400]]),
  },
];

async function seedTerritories() {
  if (!(await isEmpty(territoriesTable))) return;
  await db.insert(territoriesTable).values(TERRITORY_SEED);
  logger.info("Seeded territories");
}

// Backfill polygon bounds on territories that pre-date the polygon migration.
// Matches by name so admin-renamed rows are left alone.
async function backfillTerritoryBounds(): Promise<number> {
  const rows = await db.select().from(territoriesTable);
  const missing = rows.filter((r) => !r.bounds);
  if (missing.length === 0) return 0;
  let patched = 0;
  for (const t of missing) {
    const match = TERRITORY_SEED.find((s) => s.name === t.name);
    if (!match) continue;
    await db
      .update(territoriesTable)
      .set({ bounds: match.bounds })
      .where(eq(territoriesTable.id, t.id));
    patched += 1;
  }
  if (patched > 0) logger.info({ patched }, "Backfilled territory polygons");
  return patched;
}

async function seedPointConfigs() {
  if (!(await isEmpty(pointConfigsTable))) return;
  await db.insert(pointConfigsTable).values([
    { serviceType: "large_removal",    pointsPer100: 12, label: "Large Tree Removal" },
    { serviceType: "trimming_pruning", pointsPer100: 8,  label: "Trimming / Pruning" },
    { serviceType: "stump_grinding",   pointsPer100: 6,  label: "Stump Grinding" },
    { serviceType: "other",            pointsPer100: 5,  label: "Other Services" },
  ]);
  logger.info("Seeded point configs");
}

async function seedIncentiveTiers() {
  if (!(await isEmpty(incentiveTiersTable))) return;
  await db.insert(incentiveTiersTable).values([
    { name: "Bronze",  pointThreshold: 500,  color: "#a16a3b", description: "Getting started",       rewardDescription: "JT gear pack + Yeti tumbler",        displayOrder: 1 },
    { name: "Silver",  pointThreshold: 1500, color: "#94a3b8", description: "Solid contributor",     rewardDescription: "Bonus PTO day + $250 gift card",     displayOrder: 2 },
    { name: "Gold",    pointThreshold: 3500, color: "#FFBF00", description: "Top performer",        rewardDescription: "Bucs/Lightning tix + cash bonus",    displayOrder: 3 },
    { name: "Apex",    pointThreshold: 7500, color: "#2C8214", description: "Crew leader",          rewardDescription: "All-expenses Hawaii trip for two",   displayOrder: 4 },
  ]);
  logger.info("Seeded incentive tiers");
}

const REWARDS_SEED: Array<{
  name: string;
  description: string;
  pointCost: number;
  category: string;
  imageUrl: string;
  available: boolean;
}> = [
  { name: "JT Logo Hoodie",            description: "Premium pullover hoodie with embroidered JT mark.",                pointCost: 300,  category: "gear",        imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600", available: true },
  { name: "Yeti Tumbler (30oz)",       description: "Stainless tumbler. Keeps coffee hot, beer cold.",                  pointCost: 450,  category: "gear",        imageUrl: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600", available: true },
  { name: "JBL Charge 5 Speaker",      description: "Rugged Bluetooth speaker for the truck or the tailgate.",           pointCost: 800,  category: "electronics", imageUrl: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600", available: true },
  { name: "Nike Footwear Voucher",     description: "$200 to spend on Nike kicks or training gear.",                    pointCost: 900,  category: "gear",        imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600", available: true },
  { name: "DeWalt 20V Drill Combo",    description: "Cordless drill + impact driver kit. Tool truck favorite.",          pointCost: 1100, category: "tools",       imageUrl: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=600", available: true },
  { name: "Bucs / Lightning Tickets",  description: "Two lower-bowl seats to a Bucs or Lightning home game.",            pointCost: 1300, category: "sports",      imageUrl: "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?w=600", available: true },
  { name: "Bonus PTO Day",             description: "An extra paid day off. Burn it whenever.",                          pointCost: 1500, category: "pto",         imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600", available: true },
  { name: "Traeger Pro 575 Grill",     description: "Wi-Fi-controlled pellet grill. Sunday brisket sorted.",             pointCost: 2200, category: "gear",        imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600", available: true },
  { name: "PlayStation 5 Bundle",      description: "PS5 console with one game of your choice.",                         pointCost: 2400, category: "electronics", imageUrl: "https://images.unsplash.com/photo-1606318313846-f8e8b6c4aef9?w=600", available: true },
  { name: "Inshore Fishing Charter",   description: "Half-day for two with a guide out of Pine Island Sound.",           pointCost: 2600, category: "experiences", imageUrl: "https://images.unsplash.com/photo-1545566239-0ee5b1b06ba0?w=600", available: true },
  { name: "Top-Golf Bay (4 Hours)",    description: "Reserved bay for you and the boys. Food and drinks on the house.",  pointCost: 1800, category: "experiences", imageUrl: "https://images.unsplash.com/photo-1500932334442-8761ee4810a7?w=600", available: true },
  { name: "$500 Visa Gift Card",       description: "Cold cash on a card. Spend it however.",                            pointCost: 3000, category: "cash",        imageUrl: "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=600", available: true },
  { name: "Ford F-150 Lease (3 mo)",   description: "Three months on a JT-branded F-150. Daily driver dialed.",          pointCost: 5500, category: "experiences", imageUrl: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=600", available: true },
  { name: "Hawaii Trip for Two",       description: "All-expenses-paid 5-night trip to Maui or Oahu. The big one.",      pointCost: 7500, category: "trip",        imageUrl: "https://images.unsplash.com/photo-1542259009477-d625272157b7?w=600", available: true },
];

async function seedRewards(onlyNames?: string[]) {
  const filter = onlyNames ? new Set(onlyNames) : null;
  if (!filter && !(await isEmpty(rewardsTable))) return;
  const rows = filter ? REWARDS_SEED.filter((r) => filter.has(r.name)) : REWARDS_SEED;
  if (rows.length === 0) return;
  await db.insert(rewardsTable).values(rows);
  logger.info({ count: rows.length }, "Seeded rewards");
}

const TRAINING_SEED: Array<{
  title: string;
  description: string;
  category: string;
  contentText: string;
  thumbnailUrl: string;
  displayOrder: number;
}> = [
    {
      title: "The 7-Step Door Knock Script",
      description: "Our proven opener for SWFL homeowners.",
      category: "sales_script",
      contentText: `Step 1 — Smile, name, and reason for the visit.\nStep 2 — Reference the neighborhood ("we just finished work two doors down").\nStep 3 — Ask about their trees by name (royal palm, oak, ficus).\nStep 4 — Offer a free 5-minute walk-around.\nStep 5 — Identify one specific risk (lean, deadwood, root rot).\nStep 6 — Soft close: "Want a written quote while I'm here?"\nStep 7 — Confirm next step in writing.`,
      thumbnailUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600",
      displayOrder: 1,
    },
    {
      title: "Florida Tree ID — Top 10",
      description: "Recognize the most common SWFL species at a glance.",
      category: "tree_identification",
      contentText: `1. Live Oak — heavy lateral limbs, gray bark.\n2. Royal Palm — smooth gray trunk, towering crown.\n3. Sabal Palm (FL state tree) — fan fronds, fibrous trunk.\n4. Slash Pine — long needles in pairs.\n5. Bald Cypress — feathery, deciduous in winter.\n6. Banyan — aerial roots, massive spread.\n7. Ficus — glossy leaves, aggressive roots.\n8. Mango — dense canopy, fruit clusters.\n9. Mahogany — dark bark, compound leaves.\n10. Gumbo Limbo — peeling red bark ("tourist tree").`,
      thumbnailUrl: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=600",
      displayOrder: 2,
    },
    {
      title: "Pricing Cheatsheet — 2026",
      description: "Quick reference: typical price ranges by service type.",
      category: "product_knowledge",
      contentText: `Large removal: $1,500 – $8,000+ depending on size & access.\nTrimming: $400 – $1,800 per visit.\nStump grinding: $150 – $450 per stump.\nEmergency / storm: 1.5x baseline + after-hours fee.\nAlways quote a range, never an exact number on the spot.`,
      thumbnailUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600",
      displayOrder: 3,
    },
    {
      title: 'Handling "Your price is too high"',
      description: "Reframe price as value — three proven responses.",
      category: "objection_handling",
      contentText: `1. ACKNOWLEDGE: "Totally fair — let me show you what's included."\n2. UNBUNDLE: walk through cleanup, hauling, insurance, and warranty separately.\n3. ANCHOR: compare to the cost of one limb falling on a roof.\nNever discount on the spot. Offer to phase the work instead.`,
      thumbnailUrl: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600",
      displayOrder: 4,
    },
    {
      title: "Hurricane Prep Talk Track",
      description: "Seasonal pitch for May–October.",
      category: "sales_script",
      contentText: `Lead with safety: "Storm season starts in 6 weeks — let's get the risky limbs off before the wind picks them off for you."\nFocus on insurance: most policies require reasonable preventive care.\nClose with urgency: schedules fill up fast in June.`,
      thumbnailUrl: "https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=600",
      displayOrder: 5,
    },
    {
      title: "Royal Palm Care Guide",
      description: "What every rep should know about Florida's signature palm.",
      category: "tree_identification",
      contentText: `Royal palms are protected in many municipalities — never quote a removal without confirming local rules.\nHealthy fronds shed naturally; never cut green fronds (it stresses the tree).\nLook for ganoderma butt rot at the base — it's a death sentence and a removal opportunity.`,
      thumbnailUrl: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=600",
      displayOrder: 6,
    },
    {
      title: "Cape Coral Canal Hazards",
      description: "Specific risks for properties on the Cape's saltwater canals.",
      category: "product_knowledge",
      contentText: `Salt-pruned mangroves require permits to touch — confirm with city before pricing.\nCanal-side oaks often have undermined root systems — quote with extra rigging time.\nBoat lifts and seawalls add liability — always walk the property with the homeowner.`,
      thumbnailUrl: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=600",
      displayOrder: 7,
    },
    {
      title: "Closing on the First Visit",
      description: "Three tactics top reps use to walk away with a signed quote.",
      category: "sales_script",
      contentText: `1. SHOW your tablet — pull up a similar job we already completed nearby.\n2. SCARCITY — "We have one open slot next Tuesday before the schedule fills."\n3. SUMMARY CLOSE — recap the scope verbally, then ask "Want me to write that up right now?"`,
      thumbnailUrl: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=600",
      displayOrder: 8,
    },
    {
      title: 'Handling "Let me think about it"',
      description: "Don't let stalls become losses.",
      category: "objection_handling",
      contentText: `Acknowledge first, then probe for the real concern: price, timing, or partner sign-off.\nOffer a soft commitment: "Let's hold the slot for 48 hours — no charge to cancel."\nLeave a written quote behind — homeowners share it with their decision-maker.`,
      thumbnailUrl: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600",
      displayOrder: 9,
    },
    {
      title: "Insurance & Liability 101",
      description: "What to say when a homeowner asks about coverage.",
      category: "product_knowledge",
      contentText: `We carry $2M general liability and full workers' comp.\nWe provide a Certificate of Insurance on request — get the form to ops same-day.\nNever cut a tree on a neighbor's property without their written consent.`,
      thumbnailUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600",
      displayOrder: 10,
    },
    {
      title: "Naples HOA Playbook",
      description: "Working inside Pelican Bay, Park Shore, and similar communities.",
      category: "sales_script",
      contentText: `Always check HOA approval requirements before quoting.\nNo equipment on streets before 8am or after 5pm in most communities.\nLeave a property cleaner than you found it — referrals are the whole game in Naples.`,
      thumbnailUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600",
      displayOrder: 11,
    },
    {
      title: "Storm Damage Assessment",
      description: "Walk a damaged property like a pro.",
      category: "tree_identification",
      contentText: `Start at the roof and work down — broken limbs, hung-up debris, fence impacts.\nPhoto everything before quoting — supports the customer's insurance claim.\nNever climb after a storm without ground-spotter and full PPE.`,
      thumbnailUrl: "https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=600",
      displayOrder: 12,
    },
];

async function seedTrainingResources() {
  if (!(await isEmpty(trainingResourcesTable))) return;
  await db.insert(trainingResourcesTable).values(TRAINING_SEED);
  logger.info({ count: TRAINING_SEED.length }, "Seeded training resources");
}

async function seedMissingTrainingResources(have: Set<string>) {
  const missing = TRAINING_SEED.filter((t) => !have.has(t.title));
  if (missing.length === 0) return;
  await db.insert(trainingResourcesTable).values(missing);
  logger.info({ added: missing.length }, "Added missing training resources");
}

async function seedMockRepsAndActivity() {
  // Only seed if there are no mock reps yet (safe to run alongside real users).
  const existing = await db
    .select()
    .from(usersTable)
    .where(sql`${usersTable.clerkId} LIKE ${SEED_CLERK_PREFIX + "%"}`)
    .limit(1);
  if (existing.length > 0) return;

  // Get territory ids to assign reps round-robin.
  const terrs = await db.select().from(territoriesTable);

  // Insert mock reps.
  const inserted = await db
    .insert(usersTable)
    .values(
      MOCK_REPS.map((r, i) => ({
        clerkId: SEED_CLERK_PREFIX + r.email,
        name: r.name,
        email: r.email,
        avatarUrl: r.avatar,
        role: "rep",
        territoryId: terrs[i % terrs.length]?.id ?? null,
        accentColor: ACCENTS[i % ACCENTS.length],
        hometown: HOMETOWNS[i % HOMETOWNS.length] ?? null,
      })),
    )
    .returning();

  logger.info({ count: inserted.length }, "Seeded mock reps");

  // Seed deals: each rep gets a varied number of closed deals across the
  // last ~90 days, clustered (some hot streaks, some quiet weeks).
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  for (let i = 0; i < inserted.length; i++) {
    const rep = inserted[i]!;
    // Top reps get many deals; bottom reps get a few. Roughly 6..18 each ⇒ ~250 total.
    const dealCount = 18 - Math.floor(i * 0.5);
    for (let j = 0; j < dealCount; j++) {
      const seed = i * 100 + j;
      const service = pick(SERVICE_TYPES as unknown as ServiceType[], seed);
      const baseAmount =
        service === "large_removal"
          ? 2500 + Math.floor(rand(seed) * 8000)
          : service === "trimming_pruning"
            ? 500 + Math.floor(rand(seed) * 1500)
            : service === "stump_grinding"
              ? 200 + Math.floor(rand(seed) * 600)
              : 400 + Math.floor(rand(seed) * 1800);
      const amount = Math.round(baseAmount);
      const points = await pointsForDeal(service, amount);
      const addr = pick(SWFL_ADDRESSES, seed);
      // Cluster timing: most deals in last 30 days, some up to 90.
      // Bias top reps to recent days for fresh streaks.
      const recencyBias = i < 5 ? 0.7 : 0.4;
      const ageDays = Math.floor(
        rand(seed * 7) < recencyBias
          ? rand(seed * 11) * 14
          : 14 + rand(seed * 13) * 75,
      );
      const closedAt = new Date(now - ageDays * day);
      // Mix in two open leads per rep.
      const status = j >= dealCount - 2 ? "lead" : "closed";
      await db.insert(dealsTable).values({
        repId: rep.id,
        customerName: `${pick(["Smith","Garcia","Johnson","Nguyen","Patel","Brown","Cohen","Vega","Murphy","Cole","Diaz","Hernandez","Park","Owens","Sanders","Whitaker","Reed"], seed)} Family`,
        address: addr[0] as string,
        serviceType: service,
        amount: amount.toString(),
        status,
        pointsAwarded: status === "closed" ? points : 0,
        notes: pick(DEAL_NOTES[service], seed),
        closedAt: status === "closed" ? closedAt : null,
        createdAt: new Date(closedAt.getTime() - day),
      });
    }
    // Top 5 reps get a guaranteed mini-streak of 4 consecutive recent days.
    if (i < 5) {
      for (let k = 0; k < 4; k++) {
        const closedAt = new Date(now - k * day);
        const service: ServiceType = pick(
          SERVICE_TYPES as unknown as ServiceType[],
          i * 31 + k,
        );
        const amount = 800 + Math.floor(rand(i * 31 + k) * 4000);
        const points = await pointsForDeal(service, amount);
        const addr = pick(SWFL_ADDRESSES, i * 31 + k);
        await db.insert(dealsTable).values({
          repId: rep.id,
          customerName: `${pick(["Marshall","Bradley","Fitz","Tran","Holloway"], i + k)} Family`,
          address: addr[0] as string,
          serviceType: service,
          amount: amount.toString(),
          status: "closed",
          pointsAwarded: points,
          notes: pick(DEAL_NOTES[service], i + k),
          closedAt,
          createdAt: new Date(closedAt.getTime() - 6 * 3600 * 1000),
        });
      }
    }
    await recomputeUserPoints(rep.id);
  }

  // Seed pins distributed across SWFL — every address gets a pin, half with photos.
  for (let i = 0; i < SWFL_ADDRESSES.length; i++) {
    const [addr, lat, lng] = SWFL_ADDRESSES[i]!;
    const rep = inserted[i % inserted.length]!;
    const status = i % 4 === 0 ? "sold" : "lead";
    await db.insert(pinsTable).values({
      repId: rep.id,
      latitude: lat as number,
      longitude: lng as number,
      address: addr as string,
      status,
      notes: pick(PIN_NOTES, i),
      photoUrl: i % 2 === 0 ? pick(PIN_PHOTOS, i) : null,
      createdAt: new Date(now - Math.floor(rand(i) * 30) * day),
    });
  }

  // Award some badges to top reps (besides bot-driven ones already created
  // above) to make leaderboard look rich. The pointsForDeal/recomputeUserPoints
  // path doesn't auto-award here, so add a few signature badges.
  const top = inserted.slice(0, 4);
  for (let i = 0; i < top.length; i++) {
    const rep = top[i]!;
    const labels = [
      { type: "first_deal",   label: "First Deal",     description: "Closed your first deal — welcome to the team!" },
      { type: "century_club", label: "Century Club",   description: "Closed a deal of $10,000 or more." },
      { type: "streak",       label: "Hot Streak",     description: "Closed 5 deals in a single week." },
      { type: "top_rep",      label: "Rep of the Month", description: "Topped the leaderboard last month." },
    ];
    for (let k = 0; k <= i && k < labels.length; k++) {
      await db.insert(badgesTable).values({ userId: rep.id, ...labels[k]! });
    }
  }

  // Seed feed posts: a mix of bot wins, rep posts, and milestones over ~3 weeks.
  const feedSeed: Array<{ author: typeof inserted[number] | null; content: string; isBot: boolean; daysAgo: number; image?: string }> = [
    // Today
    { author: null,         isBot: true,  daysAgo: 0, content: `${top[0]!.name} just closed a $9,400 deal with the Garcia Family — earned 1,128 points!` },
    { author: top[0]!,      isBot: false, daysAgo: 0, content: "Big oak removal on Hibiscus Ln this morning. Crew was dialed.", image: "https://images.unsplash.com/photo-1444392061186-9fc38f84f726?w=800" },
    { author: inserted[6]!, isBot: false, daysAgo: 0, content: "Two signs of life on the Cape route — quoting both this afternoon." },
    // Day 1
    { author: null,         isBot: true,  daysAgo: 1, content: `${top[1]!.name} just earned the Century Club badge! Closed a deal of $12,500 or more.` },
    { author: top[2]!,      isBot: false, daysAgo: 1, content: "Anyone have the updated pricing sheet for stump grinding? Got a 4-stump job tomorrow." },
    { author: inserted[10]!,isBot: false, daysAgo: 1, content: "Closed my first Naples HOA job today. Process is no joke but the ticket size is real.", image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800" },
    // Day 2
    { author: null,         isBot: true,  daysAgo: 2, content: `${top[1]!.name} just closed a $4,200 deal with the Patel Family — earned 504 points!` },
    { author: top[3]!,      isBot: false, daysAgo: 2, content: "Shoutout to the Bonita crew for backing me up on the Sanibel job — clean cleanup, happy customer." },
    { author: inserted[12]!,isBot: false, daysAgo: 2, content: "Rough day of no's. Resetting tomorrow with the storm-prep opener." },
    // Day 3
    { author: null,         isBot: true,  daysAgo: 3, content: `${top[0]!.name} just earned the Hot Streak badge! Closed 5 deals in a single week.` },
    { author: inserted[5]!, isBot: false, daysAgo: 3, content: "First door knock turned into a $3,800 quote on the spot. The new opener works.", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800" },
    { author: null,         isBot: true,  daysAgo: 3, content: `${top[2]!.name} just closed a $2,150 trimming deal — earned 172 points!` },
    // Day 4
    { author: null,         isBot: true,  daysAgo: 4, content: `${inserted[4]!.name} just closed a $1,800 trimming deal — earned 144 points!` },
    { author: inserted[8]!, isBot: false, daysAgo: 4, content: "Reminder: always photograph the ganoderma rot before quoting. Customers get it instantly when they see it." },
    // Day 5
    { author: inserted[7]!, isBot: false, daysAgo: 5, content: "Heading to Naples for the Pelican Bay route today. Anyone want to swap leads?" },
    { author: null,         isBot: true,  daysAgo: 5, content: `${inserted[9]!.name} just closed a $5,600 deal with the Murphy Family — earned 672 points!` },
    // Day 6
    { author: null,         isBot: true,  daysAgo: 6, content: `Reminder: hurricane-prep season starts soon. Lead with safety in every conversation.` },
    { author: top[1]!,      isBot: false, daysAgo: 6, content: "Closed back-to-back today. Pacing for Hat Trick tomorrow.", image: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800" },
    // Day 7
    { author: top[1]!,      isBot: false, daysAgo: 7, content: "Hit 1,500 points this week. Hawaii, here I come." },
    { author: null,         isBot: true,  daysAgo: 7, content: `${inserted[3]!.name} just earned the First Deal badge! Closed your first deal — welcome to the team!` },
    // Days 8–14
    { author: inserted[11]!,isBot: false, daysAgo: 8,  content: "Shadowing Marcus today on a $11k royal palm cluster. Learning so much." },
    { author: null,         isBot: true,  daysAgo: 9,  content: `${top[3]!.name} just closed a $3,400 deal with the Brown Family — earned 408 points!` },
    { author: inserted[14]!,isBot: false, daysAgo: 10, content: "Pro tip: walk the back yard FIRST. The real money trees are usually behind the house." },
    { author: inserted[2]!, isBot: false, daysAgo: 11, content: "Updated my hometown to Cape Coral — accent color too. Checking out the new profile page!" },
    { author: null,         isBot: true,  daysAgo: 12, content: `${inserted[6]!.name} just closed a $7,800 large removal — earned 936 points!` },
    { author: top[0]!,      isBot: false, daysAgo: 13, content: "Storm cell coming through tonight. Tomorrow's going to be hot — get out early.", image: "https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=800" },
    { author: null,         isBot: true,  daysAgo: 14, content: `${top[2]!.name} just earned the Rep of the Month badge! Topped the leaderboard last month.` },
    // Days 15–21
    { author: inserted[1]!, isBot: false, daysAgo: 15, content: "Anyone running the Estero route this week? Want to coordinate." },
    { author: null,         isBot: true,  daysAgo: 16, content: `${inserted[8]!.name} just closed a $1,950 stump deal — earned 156 points!` },
    { author: inserted[16]!,isBot: false, daysAgo: 18, content: "First $5k+ deal in the books. The summary close from training is gold.", image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800" },
    { author: null,         isBot: true,  daysAgo: 20, content: `The team is 62% of the way to the Apex tier. Keep stacking points.` },
  ];

  for (const fp of feedSeed) {
    await db.insert(feedPostsTable).values({
      authorId: fp.author?.id ?? null,
      authorName: fp.author?.name ?? "Joshua Tree Bot",
      authorAvatarUrl: fp.author?.avatarUrl ?? null,
      content: fp.content,
      imageUrl: fp.image ?? null,
      isBot: fp.isBot,
      createdAt: new Date(now - fp.daysAgo * day - Math.floor(rand(fp.daysAgo + 1) * 6 * 3600 * 1000)),
    });
  }

  logger.info("Seeded mock activity (deals, pins, feed, badges)");
}

// Lines of canned hype + banter posted as comments by mock reps. Cycled
// deterministically so the feed feels active without repeating obviously.
const MOCK_COMMENTS = [
  "Let's go!",
  "This crew is unreal.",
  "Stack 'em up — Hawaii incoming.",
  "Big W. Inspiration.",
  "Was on that street last week — same vibe.",
  "Take notes y'all.",
  "Closer mentality.",
  "That's the energy.",
  "Goin' for the streak — hold my beer.",
  "Backing you up Saturday if you need a hand.",
  "Get it.",
  "Filed away. Stealing this approach.",
  "Smashing it lately.",
  "Watch out for that ganoderma — quick W follow-up.",
  "Sandwich close worked again huh.",
  "We feasting.",
];

// Seed comments + high-fives across feed posts so the social proof on the
// Hype Feed never looks empty. Idempotent: only runs when the feed has
// posts and existing comments/high-fives are below the demo threshold.
async function seedFeedSocialSignals(): Promise<void> {
  const reps = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(sql`${usersTable.clerkId} LIKE ${SEED_CLERK_PREFIX + "%"}`);
  if (reps.length === 0) return;
  const repIds = reps.map((r) => r.id);

  // Demo posts = mock-rep-authored OR bot OR NULL-author. Real-user
  // posts are excluded so we never mutate real-user content.
  const posts = await db
    .select({ id: feedPostsTable.id, isBot: feedPostsTable.isBot })
    .from(feedPostsTable)
    .where(
      or(
        isNull(feedPostsTable.authorId),
        eq(feedPostsTable.isBot, true),
        inArray(feedPostsTable.authorId, repIds),
      ),
    )
    .orderBy(desc(feedPostsTable.createdAt));
  if (posts.length === 0) return;

  // Count engagement scoped to demo posts only — high engagement on
  // real-user posts must NOT short-circuit demo signal seeding.
  const postIdsForCheck = posts.map((p) => p.id);
  const existingComments = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(commentsTable)
    .where(inArray(commentsTable.postId, postIdsForCheck));
  const existingHighFives = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(highFivesTable)
    .where(inArray(highFivesTable.postId, postIdsForCheck));

  // If the demo feed already feels alive, leave it alone.
  if (
    Number(existingComments[0]?.c ?? 0) >= posts.length &&
    Number(existingHighFives[0]?.c ?? 0) >= posts.length * 3
  ) {
    return;
  }

  // Wipe the sparse mock signals on demo posts so we can rebuild
  // deterministic richer counts. Scoped on both axes so we never delete:
  //   - real-user comments/high-fives (authorId/userId scope)
  //   - interactions on real-user-authored posts (postId scope)
  const postIds = posts.map((p) => p.id);
  await db
    .delete(commentsTable)
    .where(and(inArray(commentsTable.authorId, repIds), inArray(commentsTable.postId, postIds)));
  await db
    .delete(highFivesTable)
    .where(and(inArray(highFivesTable.userId, repIds), inArray(highFivesTable.postId, postIds)));

  let totalHighFives = 0;
  let totalComments = 0;

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i]!;
    // Bot/milestone posts get more love; rep posts get a moderate amount.
    const baseHighFives = post.isBot ? 6 : 3;
    const highFiveCount = baseHighFives + Math.floor(rand(post.id * 7) * 5);
    const distinctReps = new Set<number>();
    let safety = 0;
    while (distinctReps.size < Math.min(highFiveCount, repIds.length) && safety < 100) {
      const idx = Math.floor(rand(post.id * 13 + safety) * repIds.length);
      distinctReps.add(repIds[idx]!);
      safety += 1;
    }
    for (const userId of distinctReps) {
      await db
        .insert(highFivesTable)
        .values({ postId: post.id, userId })
        .onConflictDoNothing();
      totalHighFives += 1;
    }

    const commentCount = post.isBot
      ? 1 + Math.floor(rand(post.id * 17) * 3)
      : Math.floor(rand(post.id * 19) * 3);
    for (let k = 0; k < commentCount; k++) {
      const authorId = repIds[Math.floor(rand(post.id * 23 + k) * repIds.length)]!;
      const content = pick(MOCK_COMMENTS, post.id + k * 5);
      await db.insert(commentsTable).values({
        postId: post.id,
        authorId,
        content,
      });
      totalComments += 1;
    }
  }

  logger.info(
    { posts: posts.length, highFives: totalHighFives, comments: totalComments },
    "Seeded feed social signals",
  );
}

// Seed a handful of redemption requests by mock reps so the Vault history,
// admin queue, and "spending points" loop all look operational on launch.
// Idempotent: skips if any redemption already exists.
async function seedDemoRedemptions(): Promise<void> {
  const rewards = await db.select().from(rewardsTable);
  if (rewards.length === 0) return;

  // Idempotent per status: count ALL mock-rep redemptions broken out by
  // status, and only insert what's missing to hit the targets. Scoped
  // to mock reps so real-user redemptions are never counted or touched.
  // Top-rep ordering can shift between runs (as deals accrue), so we
  // scope on the full mock cohort rather than today's top-6 to avoid
  // missing previously-seeded demo redemptions and double-seeding.
  const TARGET_APPROVED = 6;
  const TARGET_PENDING = 2;
  const allMockReps = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(sql`${usersTable.clerkId} LIKE ${SEED_CLERK_PREFIX + "%"}`);
  if (allMockReps.length === 0) return;
  const allMockIds = allMockReps.map((r) => r.id);
  const byStatus = await db
    .select({ status: redemptionsTable.status, c: sql<number>`COUNT(*)` })
    .from(redemptionsTable)
    .where(inArray(redemptionsTable.userId, allMockIds))
    .groupBy(redemptionsTable.status);
  const have = { approved: 0, pending: 0 } as Record<string, number>;
  for (const row of byStatus) have[row.status] = Number(row.c ?? 0);
  const needApproved = Math.max(0, TARGET_APPROVED - (have.approved ?? 0));
  const needPending = Math.max(0, TARGET_PENDING - (have.pending ?? 0));
  if (needApproved === 0 && needPending === 0) return;

  // Top 6 mock reps by points = the redeemers (they have enough to spend).
  const topReps = await db
    .select()
    .from(usersTable)
    .where(sql`${usersTable.clerkId} LIKE ${SEED_CLERK_PREFIX + "%"}`)
    .orderBy(desc(usersTable.totalPoints))
    .limit(6);
  if (topReps.length === 0) return;

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const cheap = rewards.filter((r) => r.pointCost <= 1500).sort((a, b) => a.pointCost - b.pointCost);
  const mid = rewards.filter((r) => r.pointCost > 1500 && r.pointCost <= 2600);
  if (cheap.length === 0) return;

  // Plan matches the acceptance criteria: "mostly approved, a couple
  // pending". 6 approved across the top reps over the last ~3 weeks +
  // 2 pending in the last 2 days.
  const plan: Array<{ rep: typeof topReps[number]; reward: typeof rewards[number]; status: "approved" | "pending"; daysAgo: number }> = [
    { rep: topReps[0]!, reward: cheap[0]!,                              status: "approved", daysAgo: 18 },
    { rep: topReps[1]!, reward: cheap[Math.min(1, cheap.length - 1)]!, status: "approved", daysAgo: 14 },
    { rep: topReps[2]!, reward: cheap[Math.min(2, cheap.length - 1)]!, status: "approved", daysAgo: 9 },
    { rep: topReps[0]!, reward: mid[0] ?? cheap[cheap.length - 1]!,    status: "approved", daysAgo: 5 },
    { rep: topReps[3]!, reward: cheap[Math.min(1, cheap.length - 1)]!, status: "approved", daysAgo: 3 },
    { rep: topReps[4]!, reward: cheap[0]!,                              status: "approved", daysAgo: 6 },
    { rep: topReps[1]!, reward: mid[1] ?? mid[0] ?? cheap[cheap.length - 1]!, status: "pending", daysAgo: 1 },
    { rep: topReps[5 % topReps.length]!, reward: cheap[Math.min(2, cheap.length - 1)]!, status: "pending", daysAgo: 0 },
  ];

  // Top up per status so a partial demo set still converges to the
  // 6-approved + 2-pending mix without overshooting either bucket.
  const approvedSlice = plan.filter((p) => p.status === "approved").slice(0, needApproved);
  const pendingSlice = plan.filter((p) => p.status === "pending").slice(0, needPending);
  const slice = [...approvedSlice, ...pendingSlice];

  const touched = new Set<number>();
  let inserted = 0;
  for (const p of slice) {
    if (p.rep.totalPoints < p.reward.pointCost) continue;
    await db.insert(redemptionsTable).values({
      userId: p.rep.id,
      rewardId: p.reward.id,
      pointCost: p.reward.pointCost,
      status: p.status,
      createdAt: new Date(now - p.daysAgo * day),
    });
    touched.add(p.rep.id);
    inserted += 1;
  }

  // Recompute balances so the deduction shows on each rep's dashboard.
  for (const id of touched) {
    await recomputeUserPoints(id);
  }

  logger.info(
    {
      insertedApproved: approvedSlice.length,
      insertedPending: pendingSlice.length,
      reps: touched.size,
      alreadyHadApproved: have.approved ?? 0,
      alreadyHadPending: have.pending ?? 0,
    },
    "Seeded demo redemptions",
  );
}

// Seed minimal personal data for a freshly-registered real rep so the dashboard
// is not empty on first sign-in. Called from POST /users when a new rep is
// created. Idempotent per user via a check on existing deals.
export async function seedDataForNewRep(opts: {
  userId: number;
  userName: string;
  userAvatarUrl: string | null;
}): Promise<void> {
  try {
    const existing = await db
      .select({ id: dealsTable.id })
      .from(dealsTable)
      .where(eq(dealsTable.repId, opts.userId))
      .limit(1);
    if (existing.length > 0) return;

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const personal: Array<{ service: ServiceType; amount: number; customer: string; address: string; daysAgo: number; status: "closed" | "lead" }> = [
      { service: "large_removal",    amount: 4800, customer: "Hernandez Family", address: "1432 Coral Ridge Dr, Cape Coral FL", daysAgo: 1,  status: "closed" },
      { service: "trimming_pruning", amount: 1200, customer: "Whitaker Family",  address: "784 Hibiscus Ln, Fort Myers FL",     daysAgo: 4,  status: "closed" },
      { service: "stump_grinding",   amount: 450,  customer: "Reed Family",       address: "55 Pine Island Rd, Cape Coral FL",   daysAgo: 8,  status: "closed" },
      { service: "large_removal",    amount: 6200, customer: "Owens Family",      address: "999 Bayfront Pkwy, Naples FL",       daysAgo: 12, status: "closed" },
      { service: "trimming_pruning", amount: 1800, customer: "Park Family",       address: "1003 Riverside Dr, Fort Myers FL",   daysAgo: 18, status: "closed" },
      { service: "trimming_pruning", amount: 950,  customer: "Sanders Family",    address: "411 Manatee Ln, Cape Coral FL",      daysAgo: 0,  status: "lead" },
    ];

    for (const d of personal) {
      const points = await pointsForDeal(d.service, d.amount);
      const closed = d.status === "closed";
      await db.insert(dealsTable).values({
        repId: opts.userId,
        customerName: d.customer,
        address: d.address,
        serviceType: d.service,
        amount: d.amount.toString(),
        status: d.status,
        pointsAwarded: closed ? points : 0,
        notes: pick(DEAL_NOTES[d.service], d.daysAgo),
        closedAt: closed ? new Date(now - d.daysAgo * day) : null,
        createdAt: new Date(now - (d.daysAgo + 1) * day),
      });
    }
    await recomputeUserPoints(opts.userId);

    // A couple of pins for this rep.
    const pinAddrs: Array<[string, number, number, string]> = [
      ["1432 Coral Ridge Dr, Cape Coral FL", 26.6406, -82.0123, "sold"],
      ["411 Manatee Ln, Cape Coral FL",       26.6700, -82.0050, "lead"],
      ["1003 Riverside Dr, Fort Myers FL",   26.6500, -81.8700, "lead"],
    ];
    for (const [addr, lat, lng, status] of pinAddrs) {
      await db.insert(pinsTable).values({
        repId: opts.userId,
        latitude: lat,
        longitude: lng,
        address: addr,
        status,
        notes: "Recent canvass — keep warm.",
      });
    }

    // Welcome badges + welcome bot post.
    await db.insert(badgesTable).values([
      { userId: opts.userId, type: "first_deal", label: "First Deal", description: "Closed your first deal — welcome to the team!" },
    ]);
    await db.insert(feedPostsTable).values({
      authorId: null,
      authorName: "Joshua Tree Bot",
      authorAvatarUrl: null,
      content: `Welcome to the team, ${opts.userName}. Crushing it already with $4,800 closed.`,
      isBot: true,
    });
    logger.info({ userId: opts.userId }, "Seeded data for new rep");
  } catch (err) {
    logger.error({ err }, "Failed to seed data for new rep");
  }
}

