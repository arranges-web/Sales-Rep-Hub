/**
 * Integration tests for POST /api/users — the three registration paths:
 *  1. Existing-by-clerkId  → UPDATE profile fields, return 200
 *  2. Existing-by-email    → UPDATE clerkId (provider-switch recovery), return 200
 *  3. Brand-new            → INSERT + seed, return 201
 *
 * Uses the real dev database with isolated test records (unique email suffix)
 * that are cleaned up in afterEach.  @clerk/express, lib/seed, and lib/streaks
 * are mocked so no real Clerk tokens or side-effects are needed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Module mocks — must appear before any import that transitively pulls them
// ---------------------------------------------------------------------------

const mockGetAuth = vi.fn();

vi.mock("@clerk/express", () => ({
  getAuth: mockGetAuth,
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/seed.js", () => ({
  seedDataForNewRep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/streaks.js", () => ({
  computeStreaks: vi.fn().mockResolvedValue({ currentStreak: 0, bestStreak: 0, streakAtRisk: false }),
  computeStreaksForAll: vi.fn().mockResolvedValue(new Map()),
  levelInfo: vi.fn().mockReturnValue({ level: 1, nextLevelAt: 1000, pointsThisLevel: 0, pointsPerLevel: 1000 }),
}));

// ---------------------------------------------------------------------------
// Test app — minimal express wrapper around the real router
// ---------------------------------------------------------------------------

const { default: usersRouter } = await import("./users.js");

const app = express();
app.use(express.json());
app.use("/api", usersRouter);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_SUFFIX = `test-${Date.now()}`;

function testEmail(label: string) {
  return `users-route-${label}-${TEST_SUFFIX}@test.local`;
}

async function insertTestUser(clerkId: string, email: string) {
  const [row] = await db
    .insert(usersTable)
    .values({ clerkId, name: "Test User", email, role: "rep" })
    .returning();
  return row!;
}

async function cleanupByEmail(email: string) {
  await db.delete(usersTable).where(eq(usersTable.email, email));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("path 1 — existing-by-clerkId: updates profile and returns 200", async () => {
    const clerkId = `clerk-path1-${TEST_SUFFIX}`;
    const email = testEmail("path1");
    await insertTestUser(clerkId, email);

    mockGetAuth.mockReturnValue({ userId: clerkId });

    const res = await request(app).post("/api/users").send({
      clerkId,
      name: "Updated Name",
      email,
      avatarUrl: null,
    });

    expect(res.status).toBe(200);
    expect(res.body.clerkId).toBe(clerkId);
    expect(res.body.name).toBe("Updated Name");

    await cleanupByEmail(email);
  });

  it("path 2 — existing-by-email: migrates clerkId and returns 200 preserving data", async () => {
    const oldClerkId = `clerk-path2-old-${TEST_SUFFIX}`;
    const newClerkId = `clerk-path2-new-${TEST_SUFFIX}`;
    const email = testEmail("path2");
    const existing = await insertTestUser(oldClerkId, email);

    // Give the user some points so we can verify data is preserved.
    await db
      .update(usersTable)
      .set({ totalPoints: 999 })
      .where(eq(usersTable.id, existing.id));

    mockGetAuth.mockReturnValue({ userId: newClerkId });

    const res = await request(app).post("/api/users").send({
      clerkId: newClerkId,
      name: "Same Person",
      email,
      avatarUrl: null,
    });

    expect(res.status).toBe(200);
    expect(res.body.clerkId).toBe(newClerkId);
    expect(res.body.email).toBe(email);
    // Data that was NOT part of the request body must survive.
    expect(res.body.totalPoints).toBe(999);

    await cleanupByEmail(email);
  });

  it("path 3 — brand-new user: inserts and returns 201", async () => {
    const clerkId = `clerk-path3-${TEST_SUFFIX}`;
    const email = testEmail("path3");

    mockGetAuth.mockReturnValue({ userId: clerkId });

    const res = await request(app).post("/api/users").send({
      clerkId,
      name: "Brand New Rep",
      email,
      avatarUrl: null,
    });

    expect(res.status).toBe(201);
    expect(res.body.clerkId).toBe(clerkId);
    expect(res.body.email).toBe(email);
    expect(res.body.name).toBe("Brand New Rep");

    await cleanupByEmail(email);
  });
});
