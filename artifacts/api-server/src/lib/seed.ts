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
} from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { logger } from "./logger";
import { pointsForDeal, recomputeUserPoints } from "./points";

const SEED_CLERK_PREFIX = "seed_mock_";

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
    await seedPointConfigs();
    await seedIncentiveTiers();
    await seedRewards();
    await seedTrainingResources();
    await seedMockRepsAndActivity();
  } catch (err) {
    logger.error({ err }, "Seed failed");
  }
}

async function seedTerritories() {
  if (!(await isEmpty(territoriesTable))) return;
  await db.insert(territoriesTable).values([
    { name: "Cape Coral",     color: "#2EA3F2", description: "Cape Coral & surrounding canals" },
    { name: "Fort Myers",     color: "#2C8214", description: "Downtown Fort Myers & River District" },
    { name: "Naples",         color: "#FFBF00", description: "Naples & Pelican Bay" },
    { name: "Bonita / Estero", color: "#9333ea", description: "Bonita Springs & Estero corridor" },
  ]);
  logger.info("Seeded territories");
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

async function seedRewards() {
  if (!(await isEmpty(rewardsTable))) return;
  await db.insert(rewardsTable).values([
    { name: "JT Logo Hoodie",            description: "Premium pullover hoodie with embroidered JT mark.",                pointCost: 300,  category: "gear",  imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600", available: true },
    { name: "Yeti Tumbler (30oz)",       description: "Stainless tumbler. Keeps coffee hot, beer cold.",                  pointCost: 450,  category: "gear",  imageUrl: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600", available: true },
    { name: "JBL Charge 5 Speaker",      description: "Rugged Bluetooth speaker for the truck or the tailgate.",           pointCost: 800,  category: "gear",  imageUrl: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600", available: true },
    { name: "Nike Footwear Voucher",     description: "$200 to spend on Nike kicks or training gear.",                    pointCost: 900,  category: "gear",  imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600", available: true },
    { name: "DeWalt 20V Drill Combo",    description: "Cordless drill + impact driver kit. Tool truck favorite.",          pointCost: 1100, category: "gear",  imageUrl: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=600", available: true },
    { name: "Bucs / Lightning Tickets",  description: "Two lower-bowl seats to a Bucs or Lightning home game.",            pointCost: 1300, category: "other", imageUrl: "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?w=600", available: true },
    { name: "Bonus PTO Day",             description: "An extra paid day off. Burn it whenever.",                          pointCost: 1500, category: "pto",   imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600", available: true },
    { name: "Traeger Pro 575 Grill",     description: "Wi-Fi-controlled pellet grill. Sunday brisket sorted.",             pointCost: 2200, category: "gear",  imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600", available: true },
    { name: "PlayStation 5 Bundle",      description: "PS5 console with one game of your choice.",                         pointCost: 2400, category: "gear",  imageUrl: "https://images.unsplash.com/photo-1606318313846-f8e8b6c4aef9?w=600", available: true },
    { name: "Inshore Fishing Charter",   description: "Half-day for two with a guide out of Pine Island Sound.",           pointCost: 2600, category: "trip",  imageUrl: "https://images.unsplash.com/photo-1545566239-0ee5b1b06ba0?w=600", available: true },
    { name: "Top-Golf Bay (4 Hours)",    description: "Reserved bay for you and the boys. Food and drinks on the house.",  pointCost: 1800, category: "other", imageUrl: "https://images.unsplash.com/photo-1500932334442-8761ee4810a7?w=600", available: true },
    { name: "$500 Visa Gift Card",       description: "Cold cash on a card. Spend it however.",                            pointCost: 3000, category: "cash",  imageUrl: "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=600", available: true },
    { name: "Ford F-150 Lease (3 mo)",   description: "Three months on a JT-branded F-150. Daily driver dialed.",          pointCost: 5500, category: "other", imageUrl: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=600", available: true },
    { name: "Hawaii Trip for Two",       description: "All-expenses-paid 5-night trip to Maui or Oahu. The big one.",      pointCost: 7500, category: "trip",  imageUrl: "https://images.unsplash.com/photo-1542259009477-d625272157b7?w=600", available: true },
  ]);
  logger.info("Seeded rewards");
}

async function seedTrainingResources() {
  if (!(await isEmpty(trainingResourcesTable))) return;
  await db.insert(trainingResourcesTable).values([
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
  ]);
  logger.info("Seeded training resources");
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
    { author: top[0]!,      isBot: false, daysAgo: 0, content: "Big oak removal on Hibiscus Ln this morning. Crew was dialed. 🪓", image: "https://images.unsplash.com/photo-1444392061186-9fc38f84f726?w=800" },
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
    { author: top[1]!,      isBot: false, daysAgo: 6, content: "Closed back-to-back today. Pacing for Hat Trick tomorrow. 🎩", image: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800" },
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
    { author: null,         isBot: true,  daysAgo: 20, content: `🎉 The team is 62% of the way to the Hawaii goal. Keep stacking those points!` },
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

