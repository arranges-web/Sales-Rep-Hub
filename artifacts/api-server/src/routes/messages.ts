import { Router, type IRouter } from "express";
import {
  db,
  usersTable,
  conversationsTable,
  conversationMembersTable,
  messagesTable,
} from "@workspace/db";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

interface MemberSummary {
  userId: number;
  name: string;
  avatarUrl: string | null;
  accentColor: string | null;
}

async function loadMembers(conversationIds: number[]): Promise<Map<number, MemberSummary[]>> {
  if (conversationIds.length === 0) return new Map();
  const rows = await db
    .select({
      conversationId: conversationMembersTable.conversationId,
      userId: usersTable.id,
      name: usersTable.name,
      avatarUrl: usersTable.avatarUrl,
      accentColor: usersTable.accentColor,
    })
    .from(conversationMembersTable)
    .innerJoin(usersTable, eq(conversationMembersTable.userId, usersTable.id))
    .where(inArray(conversationMembersTable.conversationId, conversationIds));
  const byConvo = new Map<number, MemberSummary[]>();
  for (const r of rows) {
    const arr = byConvo.get(r.conversationId) ?? [];
    arr.push({
      userId: r.userId,
      name: r.name,
      avatarUrl: r.avatarUrl ?? null,
      accentColor: r.accentColor ?? null,
    });
    byConvo.set(r.conversationId, arr);
  }
  return byConvo;
}

router.get("/conversations", requireAuth, async (req, res, next) => {
  try {
    const me = req.currentUser!;

    // Conversations I belong to
    const myMemberships = await db
      .select({
        conversationId: conversationMembersTable.conversationId,
        lastReadAt: conversationMembersTable.lastReadAt,
      })
      .from(conversationMembersTable)
      .where(eq(conversationMembersTable.userId, me.id));

    if (myMemberships.length === 0) {
      res.json([]);
      return;
    }

    const convoIds = myMemberships.map((m) => m.conversationId);
    const lastReadByConvo = new Map(
      myMemberships.map((m) => [m.conversationId, m.lastReadAt ?? null]),
    );

    const convos = await db
      .select()
      .from(conversationsTable)
      .where(inArray(conversationsTable.id, convoIds))
      .orderBy(desc(conversationsTable.lastMessageAt));

    const membersByConvo = await loadMembers(convoIds);

    // Compute unread counts + last preview in a single round-trip
    const previews = await db
      .select({
        conversationId: messagesTable.conversationId,
        content: messagesTable.content,
        createdAt: messagesTable.createdAt,
      })
      .from(messagesTable)
      .where(
        inArray(messagesTable.conversationId, convoIds),
      )
      .orderBy(desc(messagesTable.createdAt));

    const lastPreviewByConvo = new Map<number, string>();
    for (const p of previews) {
      if (!lastPreviewByConvo.has(p.conversationId)) {
        lastPreviewByConvo.set(p.conversationId, p.content);
      }
    }

    const unreadCounts = new Map<number, number>();
    for (const cid of convoIds) {
      const lr = lastReadByConvo.get(cid);
      const count = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(messagesTable)
        .where(
          and(
            eq(messagesTable.conversationId, cid),
            lr ? gt(messagesTable.createdAt, lr) : sql`true`,
            sql`${messagesTable.authorId} <> ${me.id}`,
          ),
        );
      unreadCounts.set(cid, Number(count[0]?.c ?? 0));
    }

    res.json(
      convos.map((c) => ({
        id: c.id,
        type: c.type as "dm" | "group",
        name: c.name ?? null,
        createdBy: c.createdBy,
        createdAt: c.createdAt.toISOString(),
        lastMessageAt: c.lastMessageAt.toISOString(),
        members: membersByConvo.get(c.id) ?? [],
        lastMessagePreview: lastPreviewByConvo.get(c.id) ?? null,
        unreadCount: unreadCounts.get(c.id) ?? 0,
      })),
    );
  } catch (e) {
    next(e);
  }
});

router.post("/conversations", requireAuth, async (req, res, next) => {
  try {
    const me = req.currentUser!;
    const body = req.body ?? {};
    const type = body.type === "group" ? "group" : "dm";
    const rawIds: number[] = Array.isArray(body.memberIds) ? body.memberIds : [];
    const otherIds = Array.from(
      new Set(rawIds.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n !== me.id)),
    );

    if (otherIds.length === 0) {
      res.status(400).json({ error: "memberIds required" });
      return;
    }

    if (type === "dm") {
      if (otherIds.length !== 1) {
        res.status(400).json({ error: "DM must have exactly one other member" });
        return;
      }
      const other = otherIds[0]!;
      // Find an existing DM between me + other
      const existing = await db.execute<{ id: number }>(sql`
        SELECT c.id FROM conversations c
        WHERE c.type = 'dm'
          AND EXISTS (SELECT 1 FROM conversation_members m WHERE m.conversation_id = c.id AND m.user_id = ${me.id})
          AND EXISTS (SELECT 1 FROM conversation_members m WHERE m.conversation_id = c.id AND m.user_id = ${other})
          AND (SELECT COUNT(*) FROM conversation_members m WHERE m.conversation_id = c.id) = 2
        LIMIT 1
      `);
      const existingRow = existing.rows[0];
      if (existingRow) {
        const id = Number(existingRow.id);
        const [c] = await db
          .select()
          .from(conversationsTable)
          .where(eq(conversationsTable.id, id))
          .limit(1);
        if (c) {
          const membersByConvo = await loadMembers([c.id]);
          res.json({
            id: c.id,
            type: c.type as "dm" | "group",
            name: c.name ?? null,
            createdBy: c.createdBy,
            createdAt: c.createdAt.toISOString(),
            lastMessageAt: c.lastMessageAt.toISOString(),
            members: membersByConvo.get(c.id) ?? [],
            lastMessagePreview: null,
            unreadCount: 0,
          });
          return;
        }
      }
    }

    const [convo] = await db
      .insert(conversationsTable)
      .values({
        type,
        name: type === "group" ? (body.name ?? null) : null,
        createdBy: me.id,
      })
      .returning();
    const cid = convo!.id;

    const memberRows = [me.id, ...otherIds].map((uid) => ({
      conversationId: cid,
      userId: uid,
    }));
    await db.insert(conversationMembersTable).values(memberRows);

    const membersByConvo = await loadMembers([cid]);

    res.json({
      id: convo!.id,
      type: convo!.type as "dm" | "group",
      name: convo!.name ?? null,
      createdBy: convo!.createdBy,
      createdAt: convo!.createdAt.toISOString(),
      lastMessageAt: convo!.lastMessageAt.toISOString(),
      members: membersByConvo.get(cid) ?? [],
      lastMessagePreview: null,
      unreadCount: 0,
    });
  } catch (e) {
    next(e);
  }
});

router.get("/conversations/:conversationId", requireAuth, async (req, res, next) => {
  try {
    const me = req.currentUser!;
    const cid = Number(req.params.conversationId);
    const [member] = await db
      .select()
      .from(conversationMembersTable)
      .where(
        and(
          eq(conversationMembersTable.conversationId, cid),
          eq(conversationMembersTable.userId, me.id),
        ),
      )
      .limit(1);
    if (!member) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [c] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, cid))
      .limit(1);
    if (!c) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const membersByConvo = await loadMembers([cid]);
    res.json({
      id: c.id,
      type: c.type as "dm" | "group",
      name: c.name ?? null,
      createdBy: c.createdBy,
      createdAt: c.createdAt.toISOString(),
      lastMessageAt: c.lastMessageAt.toISOString(),
      members: membersByConvo.get(cid) ?? [],
      lastMessagePreview: null,
      unreadCount: 0,
    });
  } catch (e) {
    next(e);
  }
});

router.get("/conversations/:conversationId/messages", requireAuth, async (req, res, next) => {
  try {
    const me = req.currentUser!;
    const cid = Number(req.params.conversationId);
    const [member] = await db
      .select()
      .from(conversationMembersTable)
      .where(
        and(
          eq(conversationMembersTable.conversationId, cid),
          eq(conversationMembersTable.userId, me.id),
        ),
      )
      .limit(1);
    if (!member) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const rows = await db
      .select({
        m: messagesTable,
        name: usersTable.name,
        avatarUrl: usersTable.avatarUrl,
        accentColor: usersTable.accentColor,
      })
      .from(messagesTable)
      .leftJoin(usersTable, eq(messagesTable.authorId, usersTable.id))
      .where(eq(messagesTable.conversationId, cid))
      .orderBy(messagesTable.createdAt);
    res.json(
      rows.map((r) => ({
        id: r.m.id,
        conversationId: r.m.conversationId,
        authorId: r.m.authorId,
        authorName: r.name ?? "Unknown",
        authorAvatarUrl: r.avatarUrl ?? null,
        authorAccentColor: r.accentColor ?? null,
        content: r.m.content,
        createdAt: r.m.createdAt.toISOString(),
      })),
    );
  } catch (e) {
    next(e);
  }
});

router.post("/conversations/:conversationId/messages", requireAuth, async (req, res, next) => {
  try {
    const me = req.currentUser!;
    const cid = Number(req.params.conversationId);
    const body = req.body ?? {};
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content) {
      res.status(400).json({ error: "content required" });
      return;
    }
    const [member] = await db
      .select()
      .from(conversationMembersTable)
      .where(
        and(
          eq(conversationMembersTable.conversationId, cid),
          eq(conversationMembersTable.userId, me.id),
        ),
      )
      .limit(1);
    if (!member) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [created] = await db
      .insert(messagesTable)
      .values({
        conversationId: cid,
        authorId: me.id,
        content,
      })
      .returning();
    await db
      .update(conversationsTable)
      .set({ lastMessageAt: created!.createdAt })
      .where(eq(conversationsTable.id, cid));
    res.status(201).json({
      id: created!.id,
      conversationId: created!.conversationId,
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

router.post("/conversations/:conversationId/read", requireAuth, async (req, res, next) => {
  try {
    const me = req.currentUser!;
    const cid = Number(req.params.conversationId);
    await db
      .update(conversationMembersTable)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(conversationMembersTable.conversationId, cid),
          eq(conversationMembersTable.userId, me.id),
        ),
      );
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
