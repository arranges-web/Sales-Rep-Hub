import { Router, type IRouter } from "express";
import { db, pinsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function ser(
  p: typeof pinsTable.$inferSelect,
  repName: string,
  repAvatarUrl: string | null = null,
  repAccentColor: string | null = null,
) {
  return {
    id: p.id,
    repId: p.repId,
    repName,
    repAvatarUrl,
    repAccentColor,
    latitude: p.latitude,
    longitude: p.longitude,
    status: p.status as "lead" | "sold",
    address: p.address,
    notes: p.notes ?? null,
    photoUrl: p.photoUrl ?? null,
    dealId: p.dealId ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/pins", requireAuth, async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        p: pinsTable,
        repName: usersTable.name,
        repAvatarUrl: usersTable.avatarUrl,
        repAccentColor: usersTable.accentColor,
      })
      .from(pinsTable)
      .leftJoin(usersTable, eq(pinsTable.repId, usersTable.id))
      .orderBy(desc(pinsTable.createdAt));
    res.json(
      rows.map((r) =>
        ser(r.p, r.repName ?? "Unknown", r.repAvatarUrl ?? null, r.repAccentColor ?? null),
      ),
    );
  } catch (e) {
    next(e);
  }
});

router.post("/pins", requireAuth, async (req, res, next) => {
  try {
    const me = req.currentUser!;
    const { latitude, longitude, address, status, notes, photoUrl, dealId } = req.body ?? {};
    const [created] = await db
      .insert(pinsTable)
      .values({
        repId: me.id,
        latitude: Number(latitude),
        longitude: Number(longitude),
        address,
        status,
        notes: notes ?? null,
        photoUrl: photoUrl ?? null,
        dealId: dealId ?? null,
      })
      .returning();
    res.status(201).json(ser(created!, me.name, me.avatarUrl ?? null, me.accentColor ?? null));
  } catch (e) {
    next(e);
  }
});

router.get("/pins/:pinId", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.pinId);
    const [row] = await db
      .select({
        p: pinsTable,
        repName: usersTable.name,
        repAvatarUrl: usersTable.avatarUrl,
        repAccentColor: usersTable.accentColor,
      })
      .from(pinsTable)
      .leftJoin(usersTable, eq(pinsTable.repId, usersTable.id))
      .where(eq(pinsTable.id, id))
      .limit(1);
    if (!row) {
      res.status(404).end();
      return;
    }
    res.json(
      ser(row.p, row.repName ?? "Unknown", row.repAvatarUrl ?? null, row.repAccentColor ?? null),
    );
  } catch (e) {
    next(e);
  }
});

router.patch("/pins/:pinId", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.pinId);
    const me = req.currentUser!;
    const [existing] = await db.select().from(pinsTable).where(eq(pinsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).end();
      return;
    }
    if (existing.repId !== me.id && me.role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const body = req.body ?? {};
    const [updated] = await db
      .update(pinsTable)
      .set({
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.photoUrl !== undefined ? { photoUrl: body.photoUrl } : {}),
        ...(body.dealId !== undefined ? { dealId: body.dealId } : {}),
      })
      .where(eq(pinsTable.id, id))
      .returning();
    const [rep] = await db
      .select({
        name: usersTable.name,
        avatarUrl: usersTable.avatarUrl,
        accentColor: usersTable.accentColor,
      })
      .from(usersTable)
      .where(eq(usersTable.id, existing.repId))
      .limit(1);
    res.json(
      ser(updated!, rep?.name ?? "Unknown", rep?.avatarUrl ?? null, rep?.accentColor ?? null),
    );
  } catch (e) {
    next(e);
  }
});

router.delete("/pins/:pinId", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.pinId);
    const me = req.currentUser!;
    const [existing] = await db.select().from(pinsTable).where(eq(pinsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).end();
      return;
    }
    if (existing.repId !== me.id && me.role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    await db.delete(pinsTable).where(eq(pinsTable.id, id));
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
