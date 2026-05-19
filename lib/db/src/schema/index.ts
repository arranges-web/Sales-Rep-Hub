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
    accentColor: text("accent_color").notNull().default("#2EA3F2"),
    hometown: text("hometown"),
    bio: text("bio"),
    hawaiiGoal: text("hawaii_goal"),
    favoriteService: text("favorite_service"),
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
    residentName: text("resident_name"),
    residentPhone: text("resident_phone"),
    residentSource: text("resident_source"),
    lastKnockedAt: timestamp("last_knocked_at", { withTimezone: true }),
    /** "rep" (manual) or external integration like "jobber". */
    source: text("source").notNull().default("rep"),
    /** Stable id from the external system, e.g. "jobber:job:gid://...". */
    externalId: text("external_id"),
    /** For Jobber jobs: total invoiced value. */
    jobValue: doublePrecision("job_value"),
    /** Raw status string from Jobber (e.g., "active", "archived", "requires_invoicing"). */
    jobStatus: text("job_status"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    repIdx: index("pins_rep_idx").on(t.repId),
    externalIdx: uniqueIndex("pins_external_id_idx").on(t.externalId),
    sourceIdx: index("pins_source_idx").on(t.source),
  }),
);

export const integrationCredentialsTable = pgTable(
  "integration_credentials",
  {
    id: serial("id").primaryKey(),
    /** Stable provider key, e.g., "jobber". */
    provider: text("provider").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    accountName: text("account_name"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    /** "ok" | "failed" | null (never). */
    lastSyncStatus: text("last_sync_status"),
    lastSyncError: text("last_sync_error"),
    lastSyncJobsCount: integer("last_sync_jobs_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    providerIdx: uniqueIndex("integration_credentials_provider_idx").on(t.provider),
  }),
);

// Cache geocoded address → lat/lng so we don't re-hit Nominatim. Keyed on
// the raw address string; consumers should normalize before lookup.
export const geocodeCacheTable = pgTable(
  "geocode_cache",
  {
    address: text("address").primaryKey(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    resolvedAddress: text("resolved_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
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

export const conversationsTable = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(), // 'dm' | 'group'
    name: text("name"), // group name (optional even for groups)
    createdBy: integer("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    typeIdx: index("conversations_type_idx").on(t.type),
  }),
);

export const conversationMembersTable = pgTable(
  "conversation_members",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id").notNull(),
    userId: integer("user_id").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  },
  (t) => ({
    convoIdx: index("conv_members_convo_idx").on(t.conversationId),
    userIdx: index("conv_members_user_idx").on(t.userId),
    uniq: uniqueIndex("conv_members_unique_idx").on(t.conversationId, t.userId),
  }),
);

export const messagesTable = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id").notNull(),
    authorId: integer("author_id").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    convoIdx: index("messages_convo_idx").on(t.conversationId),
  }),
);

export const campaignsTable = pgTable(
  "campaigns",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    /** "door" | "flyer" */
    type: text("type").notNull().default("door"),
    color: text("color").notNull().default("#2EA3F2"),
    /** "active" | "paused" | "complete" */
    status: text("status").notNull().default("active"),
    createdBy: integer("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("campaigns_status_idx").on(t.status),
  }),
);

export const campaignStreetsTable = pgTable(
  "campaign_streets",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id").notNull(),
    name: text("name").notNull(),
    city: text("city"),
    notes: text("notes"),
    /** "pending" | "in_progress" | "done" | "skipped" */
    status: text("status").notNull().default("pending"),
    assignedToUserId: integer("assigned_to_user_id"),
    completedByUserId: integer("completed_by_user_id"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    flyersHandedOut: integer("flyers_handed_out").notNull().default(0),
    doorsKnocked: integer("doors_knocked").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    campIdx: index("campaign_streets_camp_idx").on(t.campaignId),
    statusIdx: index("campaign_streets_status_idx").on(t.status),
  }),
);

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
export type Conversation = typeof conversationsTable.$inferSelect;
export type ConversationMember = typeof conversationMembersTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type Campaign = typeof campaignsTable.$inferSelect;
export type CampaignStreet = typeof campaignStreetsTable.$inferSelect;
export type IntegrationCredential = typeof integrationCredentialsTable.$inferSelect;
export type GeocodeCacheRow = typeof geocodeCacheTable.$inferSelect;
