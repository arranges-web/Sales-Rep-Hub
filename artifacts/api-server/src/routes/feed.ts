import { Router, type IRouter } from "express";
import { db, feedPostsTable, highFivesTable, commentsTable, usersTable } from "@workspace/db";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { levelInfo } from "../lib/streaks";

const router: IRouter = Router();

router.get("/feed", requireAuth, async (req, res, next) => {
  try {
    const me = req.currentUser!;
    const posts = await db.select().from(feedPostsTable).orderBy(desc(feedPostsTable.createdAt));
    const authorIds = Array.from(
      new Set(posts.map((p) => p.authorId).filter((x): x is number => typeof x === "number")),
    );
    const authorRows = authorIds.length
      ? await db
          .select({
            id: usersTable.id,
            accentColor: usersTable.accentColor,
            avatarUrl: usersTable.avatarUrl,
            hometown: usersTable.hometown,
            totalPoints: usersTable.totalPoints,
          })
          .from(usersTable)
          .where(inArray(usersTable.id, authorIds))
      : [];
    const accentById = new Map(authorRows.map((a) => [a.id, a.accentColor]));
    const avatarById = new Map(authorRows.map((a) => [a.id, a.avatarUrl]));
    const hometownById = new Map(authorRows.map((a) => [a.id, a.hometown]));
    const levelById = new Map(authorRows.map((a) => [a.id, levelInfo(a.totalPoints).level]));

    const postIds = posts.map((p) => p.id);
    const hfCountRows = postIds.length
      ? await db
          .select({ postId: highFivesTable.postId, c: sql<number>`COUNT(*)` })
          .from(highFivesTable)
          .where(inArray(highFivesTable.postId, postIds))
          .groupBy(highFivesTable.postId)
      : [];
    const ccCountRows = postIds.length
      ? await db
          .select({ postId: commentsTable.postId, c: sql<number>`COUNT(*)` })
          .from(commentsTable)
          .where(inArray(commentsTable.postId, postIds))
          .groupBy(commentsTable.postId)
      : [];
    const mineRows = postIds.length
      ? await db
          .select({ postId: highFivesTable.postId })
          .from(highFivesTable)
          .where(
            and(
              inArray(highFivesTable.postId, postIds),
              eq(highFivesTable.userId, me.id),
            ),
          )
      : [];
    const hfByPost = new Map(hfCountRows.map((r) => [r.postId, Number(r.c)]));
    const ccByPost = new Map(ccCountRows.map((r) => [r.postId, Number(r.c)]));
    const minedSet = new Set(mineRows.map((r) => r.postId));

    const result = posts.map((p) => ({
      id: p.id,
      authorId: p.authorId ?? null,
      authorName: p.authorName,
      authorAvatarUrl: (p.authorId != null ? avatarById.get(p.authorId) : null) ?? p.authorAvatarUrl ?? null,
      authorAccentColor: p.authorId != null ? accentById.get(p.authorId) ?? null : null,
      authorHometown: p.authorId != null ? hometownById.get(p.authorId) ?? null : null,
      authorLevel: p.authorId != null ? levelById.get(p.authorId) ?? null : null,
      content: p.content,
      imageUrl: p.imageUrl ?? null,
      isBot: p.isBot,
      highFiveCount: hfByPost.get(p.id) ?? 0,
      hasHighFived: minedSet.has(p.id),
      commentCount: ccByPost.get(p.id) ?? 0,
      dealId: p.dealId ?? null,
      createdAt: p.createdAt.toISOString(),
    }));
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.post("/feed", requireAuth, async (req, res, next) => {
  try {
    const me = req.currentUser!;
    const { content, imageUrl } = req.body ?? {};
    const [created] = await db
      .insert(feedPostsTable)
      .values({
        authorId: me.id,
        authorName: me.name,
        authorAvatarUrl: me.avatarUrl,
        content,
        imageUrl: imageUrl ?? null,
        isBot: false,
      })
      .returning();
    res.status(201).json({
      id: created!.id,
      authorId: created!.authorId,
      authorName: created!.authorName,
      authorAvatarUrl: created!.authorAvatarUrl,
      authorAccentColor: me.accentColor,
      authorHometown: me.hometown ?? null,
      authorLevel: levelInfo(me.totalPoints).level,
      content: created!.content,
      imageUrl: created!.imageUrl,
      isBot: created!.isBot,
      highFiveCount: 0,
      hasHighFived: false,
      commentCount: 0,
      dealId: created!.dealId ?? null,
      createdAt: created!.createdAt.toISOString(),
    });
  } catch (e) {
    next(e);
  }
});

router.delete("/feed/:postId", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.postId);
    const me = req.currentUser!;
    const [p] = await db.select().from(feedPostsTable).where(eq(feedPostsTable.id, id)).limit(1);
    if (!p) {
      res.status(404).end();
      return;
    }
    if (me.role !== "admin" && p.authorId !== me.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    await db.delete(commentsTable).where(eq(commentsTable.postId, id));
    await db.delete(highFivesTable).where(eq(highFivesTable.postId, id));
    await db.delete(feedPostsTable).where(eq(feedPostsTable.id, id));
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

router.post("/feed/:postId/highfive", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.postId);
    const me = req.currentUser!;
    const [existing] = await db
      .select()
      .from(highFivesTable)
      .where(and(eq(highFivesTable.postId, id), eq(highFivesTable.userId, me.id)))
      .limit(1);
    let hasHighFived: boolean;
    if (existing) {
      await db.delete(highFivesTable).where(eq(highFivesTable.id, existing.id));
      hasHighFived = false;
    } else {
      await db.insert(highFivesTable).values({ postId: id, userId: me.id });
      hasHighFived = true;
    }
    const [hf] = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(highFivesTable)
      .where(eq(highFivesTable.postId, id));
    res.json({ highFiveCount: Number(hf?.c ?? 0), hasHighFived });
  } catch (e) {
    next(e);
  }
});

router.get("/feed/:postId/comments", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.postId);
    const rows = await db
      .select({
        c: commentsTable,
        authorName: usersTable.name,
        authorAvatarUrl: usersTable.avatarUrl,
        authorAccentColor: usersTable.accentColor,
      })
      .from(commentsTable)
      .leftJoin(usersTable, eq(commentsTable.authorId, usersTable.id))
      .where(eq(commentsTable.postId, id))
      .orderBy(commentsTable.createdAt);
    res.json(
      rows.map((r) => ({
        id: r.c.id,
        postId: r.c.postId,
        authorId: r.c.authorId,
        authorName: r.authorName ?? "Unknown",
        authorAvatarUrl: r.authorAvatarUrl ?? null,
        authorAccentColor: r.authorAccentColor ?? null,
        content: r.c.content,
        createdAt: r.c.createdAt.toISOString(),
      })),
    );
  } catch (e) {
    next(e);
  }
});

router.post("/feed/:postId/comments", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.postId);
    const me = req.currentUser!;
    const { content } = req.body ?? {};
    const [created] = await db
      .insert(commentsTable)
      .values({ postId: id, authorId: me.id, content })
      .returning();
    res.status(201).json({
      id: created!.id,
      postId: created!.postId,
      authorId: created!.authorId,
      authorName: me.name,
      authorAvatarUrl: me.avatarUrl ?? null,
      authorAccentColor: me.accentColor ?? null,
      content: created!.content,
      createdAt: created!.createdAt.toISOString(),
    });
  } catch (e) {
    next(e);
  }
});

router.delete("/feed/:postId/comments/:commentId", requireAuth, async (req, res, next) => {
  try {
    const cid = Number(req.params.commentId);
    const me = req.currentUser!;
    const [c] = await db.select().from(commentsTable).where(eq(commentsTable.id, cid)).limit(1);
    if (!c) {
      res.status(404).end();
      return;
    }
    if (me.role !== "admin" && c.authorId !== me.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    await db.delete(commentsTable).where(eq(commentsTable.id, cid));
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
