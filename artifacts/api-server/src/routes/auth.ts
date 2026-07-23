import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import {
  signToken,
  verifyTeamPassword,
  isTeamPasswordSet,
} from "../lib/authToken";
import { seedDataForNewRep } from "../lib/seed";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * Turn a typed-in display name into a stable identity key. Case- and
 * punctuation-insensitive so "Marcus R.", "marcus r", and "MARCUS  R"
 * all resolve to the same rep — the first person to use a name owns it.
 */
function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, 120);
}

// Public: whether a shared password is required, so the login screen can hide
// the password field when access is still open (pre first-admin).
router.get("/auth/config", async (_req, res, next) => {
  try {
    res.json({ teamPasswordRequired: await isTeamPasswordSet() });
  } catch (e) {
    next(e);
  }
});

/**
 * Username + shared-team-password login. Creates the rep on first use. No
 * per-person password — the shared password (if set) is the only gate. The
 * very first rep to sign in becomes admin.
 */
router.post("/auth/login", async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const rawName = typeof body.name === "string" ? body.name : "";
    const displayName = cleanName(rawName);
    const slug = slugifyName(rawName);

    if (!displayName || !slug) {
      res.status(400).json({ error: "Enter your name to continue." });
      return;
    }

    if (!(await verifyTeamPassword(body.password))) {
      res.status(401).json({ error: "That team password isn't right." });
      return;
    }

    const clerkId = `local:${slug}`;
    const email = `${slug}@rep.local`;

    let [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, clerkId))
      .limit(1);

    if (!user) {
      // First registered user becomes admin.
      const anyUser = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
      const role = anyUser.length === 0 ? "admin" : "rep";
      const [created] = await db
        .insert(usersTable)
        .values({ clerkId, name: displayName, email, role })
        .returning();
      user = created!;
      logger.info({ slug, role }, "New rep registered via username login");
      if (role === "rep") {
        await seedDataForNewRep({
          userId: user.id,
          userName: user.name,
          userAvatarUrl: user.avatarUrl ?? null,
        });
        const [refreshed] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, user.id))
          .limit(1);
        if (refreshed) user = refreshed;
      }
    } else if (user.name !== displayName) {
      // Let a returning rep refine their display capitalization/spacing.
      const [updated] = await db
        .update(usersTable)
        .set({ name: displayName })
        .where(eq(usersTable.id, user.id))
        .returning();
      if (updated) user = updated;
    }

    const token = await signToken(clerkId);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role as "admin" | "rep",
        avatarUrl: user.avatarUrl ?? null,
      },
    });
  } catch (e) {
    next(e);
  }
});

// Confirm a token is still valid and echo who it belongs to. The client hits
// this on boot to restore a session from localStorage.
router.get("/auth/session", requireAuth, async (req, res) => {
  const u = req.currentUser!;
  res.json({
    id: u.id,
    name: u.name,
    role: u.role as "admin" | "rep",
    avatarUrl: u.avatarUrl ?? null,
  });
});

export default router;
