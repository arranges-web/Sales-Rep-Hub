import { Router, type IRouter } from "express";
import { db, usersTable, territoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { getAuth } from "@clerk/express";
import { seedDataForNewRep } from "../lib/seed";

const router: IRouter = Router();

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function sanitizeAccent(c: unknown): string | undefined {
  if (typeof c !== "string") return undefined;
  return HEX_RE.test(c) ? c : undefined;
}

function serializeUser(u: typeof usersTable.$inferSelect, territoryName: string | null = null) {
  return {
    id: u.id,
    clerkId: u.clerkId,
    name: u.name,
    email: u.email,
    role: u.role as "admin" | "rep",
    avatarUrl: u.avatarUrl ?? null,
    accentColor: u.accentColor ?? "#2EA3F2",
    hometown: u.hometown ?? null,
    bio: u.bio ?? null,
    hawaiiGoal: u.hawaiiGoal ?? null,
    favoriteService: u.favoriteService ?? null,
    totalPoints: u.totalPoints,
    territoryId: u.territoryId ?? null,
    territoryName,
    createdAt: u.createdAt.toISOString(),
  };
}

router.post("/users", async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { clerkId, name, email, avatarUrl } = req.body ?? {};
    if (clerkId !== userId) {
      res.status(400).json({ error: "clerkId mismatch" });
      return;
    }
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, clerkId))
      .limit(1);
    if (existing) {
      const [updated] = await db
        .update(usersTable)
        .set({ name, email, avatarUrl: avatarUrl ?? null })
        .where(eq(usersTable.id, existing.id))
        .returning();
      res.json(serializeUser(updated!));
      return;
    }
    // First user becomes admin
    const all = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
    const role = all.length === 0 ? "admin" : "rep";
    const [created] = await db
      .insert(usersTable)
      .values({ clerkId, name, email, avatarUrl: avatarUrl ?? null, role })
      .returning();
    // Seed a baseline of mock activity for new reps so the dashboard isn't
    // empty on first load. Awaited so /users/me sees the data immediately.
    if (created && role === "rep") {
      await seedDataForNewRep({
        userId: created.id,
        userName: created.name,
        userAvatarUrl: created.avatarUrl ?? null,
      });
    }
    // Re-fetch so totalPoints reflects seeded deals.
    const [final] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, created!.id))
      .limit(1);
    res.status(201).json(serializeUser(final ?? created!));
  } catch (e) {
    next(e);
  }
});

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
    res.json(serializeUser(u, territoryName));
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

router.get("/users", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        u: usersTable,
        territoryName: territoriesTable.name,
      })
      .from(usersTable)
      .leftJoin(territoriesTable, eq(usersTable.territoryId, territoriesTable.id));
    res.json(rows.map((r) => serializeUser(r.u, r.territoryName)));
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
    const full = serializeUser(u, territoryName);
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
    const { name, role, avatarUrl, territoryId } = req.body ?? {};
    const [updated] = await db
      .update(usersTable)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        ...(territoryId !== undefined ? { territoryId } : {}),
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
