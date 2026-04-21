import { Router, type IRouter } from "express";
import { db, territoriesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

function ser(t: typeof territoriesTable.$inferSelect, repName: string | null) {
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? null,
    assignedRepId: t.assignedRepId ?? null,
    assignedRepName: repName,
    color: t.color,
    bounds: t.bounds ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}

router.get("/territories", requireAuth, async (_req, res, next) => {
  try {
    const rows = await db
      .select({ t: territoriesTable, repName: usersTable.name })
      .from(territoriesTable)
      .leftJoin(usersTable, eq(territoriesTable.assignedRepId, usersTable.id));
    res.json(rows.map((r) => ser(r.t, r.repName)));
  } catch (e) {
    next(e);
  }
});

router.post("/territories", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, description, assignedRepId, color, bounds } = req.body ?? {};
    const [created] = await db
      .insert(territoriesTable)
      .values({
        name,
        description: description ?? null,
        assignedRepId: assignedRepId ?? null,
        color: color ?? "#2EA3F2",
        bounds: bounds ?? null,
      })
      .returning();
    res.status(201).json(ser(created!, null));
  } catch (e) {
    next(e);
  }
});

router.patch("/territories/:territoryId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.territoryId);
    const body = req.body ?? {};
    const [updated] = await db
      .update(territoriesTable)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.assignedRepId !== undefined ? { assignedRepId: body.assignedRepId } : {}),
        ...(body.color !== undefined ? { color: body.color } : {}),
        ...(body.bounds !== undefined ? { bounds: body.bounds } : {}),
      })
      .where(eq(territoriesTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).end();
      return;
    }
    let repName: string | null = null;
    if (updated.assignedRepId) {
      const [r] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, updated.assignedRepId)).limit(1);
      repName = r?.name ?? null;
    }
    res.json(ser(updated, repName));
  } catch (e) {
    next(e);
  }
});

router.delete("/territories/:territoryId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.territoryId);
    await db.delete(territoriesTable).where(eq(territoriesTable.id, id));
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
