import { beforeAll, describe, expect, it } from "vitest";
import { hasTestDatabase } from "../setup/test-db";
import { agent, member, mcpClient, owner, seedAgent, seedBoard } from "../setup/fixtures";

describe.skipIf(!hasTestDatabase)("card read pagination", async () => {
  const { db } = await import("@/lib/db");
  const cards = await import("@/lib/domain/cards");

  beforeAll(() => { process.env.MCP_ENABLED = "true"; });

  it("pages activity by event id despite out-of-order timestamps and reports the last version-changing actor", async () => {
    const { lists } = await seedBoard(owner());
    const { card } = await cards.createCard(agent(), { listId: lists.todo.id, title: "Card" });
    await cards.updateCard(member(), { cardId: card.id, title: "Edited" });
    await cards.moveCard(owner(), { cardId: card.id, toListId: lists.todo.id });
    for (const [eventId, seconds] of [[1, 20], [2, 10], [3, 30]]) {
      await db.auditLog.updateMany({
        where: { orgId: "org_test", eventId },
        data: { createdAt: new Date(seconds * 1000) },
      });
    }
    // Pre-cursor history has no event id and must not displace sequenced events.
    const entry = await db.auditLog.findFirstOrThrow({ where: { eventId: 1 } });
    await db.auditLog.create({ data: { ...entry, id: "historical", eventId: null } });

    const first = await cards.getCard(agent(), card.id, { activityLimit: 2 });
    expect(first.activity.map((e) => e.eventId)).toEqual([3, 2]);
    const second = await cards.getCard(agent(), card.id, { activityLimit: 2, activityBefore: 2 });
    expect(second.activity.map((e) => e.eventId)).toEqual([1]);
    await expect(cards.updateCard(agent(), {
      cardId: card.id, title: "Stale", expectedVersion: 1,
    })).rejects.toMatchObject({
      type: "stale_version", details: { lastActor: { kind: "MEMBER" } },
    });
    await cards.moveCard(owner(), { cardId: card.id, toListId: lists.done.id });
    await expect(cards.updateCard(agent(), {
      cardId: card.id, title: "Stale", expectedVersion: 2,
    })).rejects.toMatchObject({
      type: "stale_version", details: { lastActor: { kind: "OWNER" } },
    });
  });

  it("MCP returns the original default page and reaches all 103 comments exactly once, including tied timestamps and the newest", async () => {
    const { lists } = await seedBoard(owner());
    const { card } = await cards.createCard(agent(), { listId: lists.todo.id, title: "Card" });
    await db.comment.createMany({ data: Array.from({ length: 103 }, (_, i) => ({
      id: `comment-${String(102 - i).padStart(3, "0")}`,
      cardId: card.id, orgId: "org_test", body: `Note ${102 - i}`,
      actorKind: "AGENT" as const, actorId: "agent", actorName: "Helper", surface: "MCP" as const,
      createdAt: new Date(i === 0 ? 2000 : 1000),
    })) });
    const client = await mcpClient((await seedAgent(owner(), "agent")).secret);
    try {
      const first = await client.call("get_card", { cardId: card.id });
      expect(first.isError).toBe(false);
      expect(first.body.comments).toHaveLength(50);
      expect(first.body.comments[0].id).toBe("comment-000");
      expect(first.body.commentHasMore).toBe(true);
      const ids = first.body.comments.map((c: { id: string }) => c.id);
      let page = first.body;
      while (page.commentHasMore) {
        const next = await client.call("get_card", { cardId: card.id, commentCursor: page.commentNextCursor });
        expect(next.isError).toBe(false);
        page = next.body;
        ids.push(...page.comments.map((c: { id: string }) => c.id));
      }
      expect(ids).toEqual(Array.from({ length: 103 }, (_, i) => `comment-${String(i).padStart(3, "0")}`));
      expect(new Set(ids).size).toBe(103);
      expect(page.commentNextCursor).toBeNull();
      const bad = await client.call("get_card", { cardId: card.id, commentCursor: "invalid" });
      expect(bad.body.error.type).toBe("invalid");
    } finally { await client.close(); }
  });
});
