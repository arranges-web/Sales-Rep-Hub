/**
 * Integration tests for the username + team-password login flow.
 *
 * Uses the real dev database with isolated test records (unique name suffix)
 * cleaned up in afterEach. lib/seed and lib/streaks are mocked so no demo
 * side-effects run.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";
import { db, usersTable, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

vi.mock("../lib/seed.js", () => ({
  seedDataForNewRep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/streaks.js", () => ({
  computeStreaks: vi.fn().mockResolvedValue({ currentStreak: 0, bestStreak: 0, streakAtRisk: false }),
  computeStreaksForAll: vi.fn().mockResolvedValue(new Map()),
  levelInfo: vi.fn().mockReturnValue({ level: 1, nextLevelAt: 1000, pointsThisLevel: 0, pointsPerLevel: 1000 }),
}));

const { default: authRouter } = await import("./auth.js");
const { setTeamPassword } = await import("../lib/authToken.js");

const app = express();
app.use(express.json());
app.use("/api", authRouter);

const SUFFIX = `test-${Date.now()}`;

async function cleanup(slug: string) {
  await db.delete(usersTable).where(eq(usersTable.clerkId, `local:${slug}`));
}

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Start each test with open access (no team password).
    await db.delete(appSettingsTable).where(eq(appSettingsTable.key, "team_password_hash"));
  });

  it("registers a brand-new rep and returns a token", async () => {
    const name = `Rep One ${SUFFIX}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    const res = await request(app).post("/api/auth/login").send({ name });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.name).toBe(name.replace(/\s+/g, " "));

    await cleanup(slug);
  });

  it("returns the same identity for a name typed with different casing/spacing", async () => {
    const base = `Marcus R ${SUFFIX}`;
    const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    const first = await request(app).post("/api/auth/login").send({ name: base });
    const second = await request(app)
      .post("/api/auth/login")
      .send({ name: `  marcus   r ${SUFFIX.toUpperCase()}  ` });

    expect(first.body.user.id).toBe(second.body.user.id);

    await cleanup(slug);
  });

  it("rejects a wrong team password once one is set", async () => {
    await setTeamPassword("hunter2");
    try {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ name: `Rep Three ${SUFFIX}`, password: "wrong" });
      expect(res.status).toBe(401);
    } finally {
      await setTeamPassword(null);
    }
  });

  it("accepts the correct team password", async () => {
    await setTeamPassword("hunter2");
    const name = `Rep Four ${SUFFIX}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    try {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ name, password: "hunter2" });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
    } finally {
      await setTeamPassword(null);
      await cleanup(slug);
    }
  });

  it("requires a name", async () => {
    const res = await request(app).post("/api/auth/login").send({ name: "   " });
    expect(res.status).toBe(400);
  });
});
