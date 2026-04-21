import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  doublePrecision,
  numeric,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const territoriesTable = pgTable("territories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  assignedRepId: integer("assigned_rep_id"),
  color: text("color").notNull().default("#2EA3F2"),
  bounds: text("bounds"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull().default("rep"),
    avatarUrl: text("avatar_url"),
    totalPoints: integer("total_points").notNull().default(0),
    territoryId: integer("territory_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clerkIdx: uniqueIndex("users_clerk_id_idx").on(t.clerkId),
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
  }),
);

export const dealsTable = pgTable(
  "deals",
  {
    id: serial("id").primaryKey(),
    repId: integer("rep_id").notNull(),
    customerName: text("customer_name").notNull(),
    address: text("address").notNull(),
    serviceType: text("service_type").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    status: text("status").notNull().default("lead"),
    pointsAwarded: integer("points_awarded").notNull().default(0),
    notes: text("notes"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    repIdx: index("deals_rep_idx").on(t.repId),
    statusIdx: index("deals_status_idx").on(t.status),
  }),
);

export const feedPostsTable = pgTable(
  "feed_posts",
  {
    id: serial("id").primaryKey(),
    authorId: integer("author_id"),
    authorName: text("author_name").notNull(),
    authorAvatarUrl: text("author_avatar_url"),
    content: text("content").notNull(),
    imageUrl: text("image_url"),
    isBot: boolean("is_bot").notNull().default(false),
    dealId: integer("deal_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    createdIdx: index("feed_posts_created_idx").on(t.createdAt),
  }),
);

export const highFivesTable = pgTable(
  "high_fives",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").notNull(),
    userId: integer("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("high_fives_post_user_idx").on(t.postId, t.userId),
  }),
);

export const commentsTable = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").notNull(),
    authorId: integer("author_id").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    postIdx: index("comments_post_idx").on(t.postId),
  }),
);

export const pinsTable = pgTable(
  "pins",
  {
    id: serial("id").primaryKey(),
    repId: integer("rep_id").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    status: text("status").notNull().default("lead"),
    address: text("address").notNull(),
    notes: text("notes"),
    photoUrl: text("photo_url"),
    dealId: integer("deal_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    repIdx: index("pins_rep_idx").on(t.repId),
  }),
);

export const rewardsTable = pgTable("rewards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  pointCost: integer("point_cost").notNull(),
  category: text("category").notNull().default("other"),
  imageUrl: text("image_url"),
  available: boolean("available").notNull().default(true),
  stock: integer("stock"),
});

export const redemptionsTable = pgTable("redemptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  rewardId: integer("reward_id").notNull(),
  pointCost: integer("point_cost").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const badgesTable = pgTable(
  "badges",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    type: text("type").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull(),
    dealId: integer("deal_id"),
    earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("badges_user_idx").on(t.userId),
  }),
);

export const incentiveTiersTable = pgTable("incentive_tiers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  pointThreshold: integer("point_threshold").notNull(),
  color: text("color").notNull().default("#FFBF00"),
  description: text("description").notNull().default(""),
  rewardDescription: text("reward_description").notNull().default(""),
  displayOrder: integer("display_order").notNull().default(0),
});

export const pointConfigsTable = pgTable("point_configs", {
  id: serial("id").primaryKey(),
  serviceType: text("service_type").notNull().unique(),
  pointsPer100: integer("points_per_100").notNull(),
  label: text("label").notNull(),
});

export const trainingResourcesTable = pgTable("training_resources", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull().default("other"),
  contentUrl: text("content_url"),
  contentText: text("content_text"),
  thumbnailUrl: text("thumbnail_url"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type Deal = typeof dealsTable.$inferSelect;
export type Pin = typeof pinsTable.$inferSelect;
export type Territory = typeof territoriesTable.$inferSelect;
export type FeedPost = typeof feedPostsTable.$inferSelect;
export type HighFive = typeof highFivesTable.$inferSelect;
export type CommentRow = typeof commentsTable.$inferSelect;
export type Reward = typeof rewardsTable.$inferSelect;
export type Redemption = typeof redemptionsTable.$inferSelect;
export type Badge = typeof badgesTable.$inferSelect;
export type IncentiveTier = typeof incentiveTiersTable.$inferSelect;
export type PointConfig = typeof pointConfigsTable.$inferSelect;
export type TrainingResource = typeof trainingResourcesTable.$inferSelect;
