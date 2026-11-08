import { afterEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase } from "../setup/test-db";
import { agent, member, owner, seedBoard } from "../setup/fixtures";
import * as audit from "@/lib/domain/audit";
import { cloneList } from "@/lib/domain/lists";
import { addComment } from "@/lib/domain/comments";
import { getChanges } from "@/lib/domain/changes";
import { db } from "@/lib/db";

const runTransaction = audit.transaction;
afterEach(() => vi.restoreAllMocks());
describe.skipIf(!hasTestDatabase)("transactional list clone", () => {
  async function fixture() {
    const { board, lists } = await seedBoard(owner());
    await db.card.createMany({ data: ["b", "a"].map((id) => ({
      id, title: id, description: `Description ${id}`, order: 1, listId: lists.todo.id,
      creatorKind: "AGENT", creatorId: "source-agent", creatorName: "Demo agent", creatorSurface: "MCP",
    })) });
    const label = await db.label.create({ data: { orgId: board.orgId, name: "Review", color: "red" } });
    await db.cardLabel.create({ data: { cardId: "b", labelId: label.id } });
    await addComment(owner(), { cardId: "b", body: "Keep on source" });
    return { board, lists, label };
  }

  const snapshot = async () => ({
    lists: await db.list.findMany({ orderBy: { id: "asc" } }),
    cards: await db.card.findMany({ orderBy: { id: "asc" } }),
    labels: await db.cardLabel.findMany({ orderBy: { id: "asc" } }),
    comments: await db.comment.findMany({ orderBy: { id: "asc" } }),
    events: await db.auditLog.findMany({ orderBy: { eventId: "asc" } }),
  });

  it.each([owner(), member()])("clones tied positions as $kind with correct labels, attribution and no comments", async (actor) => {
    const { board, lists, label } = await fixture();
    const cursor = (await getChanges(actor)).nextCursor;
    const clone = await cloneList(actor, { id: lists.todo.id, boardId: board.id });
    expect(clone).toMatchObject({ title: "To do - Clone", order: 4 });
    const cards = await db.card.findMany({
      where: { listId: clone.id }, orderBy: { order: "asc" }, include: { labels: true, comments: true },
    });
    expect(cards.map((c) => [c.title, c.description, c.order, c.labels.map((l) => l.labelId)])).toEqual([
      ["a", "Description a", 0, []], ["b", "Description b", 1, [label.id]],
    ]);
    for (const card of cards) {
      expect(card.id).not.toBe(card.title);
      expect(card).toMatchObject({ creatorKind: actor.kind, creatorId: actor.id, creatorName: actor.name, creatorSurface: actor.surface, version: 1, comments: [] });
    }
    expect(await db.comment.count()).toBe(1);
    expect((await getChanges(actor, { cursor })).events).toMatchObject([
      { action: "CREATE", entityType: "LIST", entityId: clone.id, actor: { kind: actor.kind } },
    ]);
  });

  it("retains workspace and board guards and rejects agents without writes", async () => {
    const { board, lists } = await fixture();
    const before = await snapshot();
    const command = { id: lists.todo.id, boardId: board.id };
    await expect(cloneList(member("other"), command)).rejects.toMatchObject({ type: "not_found" });
    await expect(cloneList(member(), { ...command, boardId: "other-board" })).rejects.toMatchObject({ type: "not_found" });
    await expect(cloneList(agent(), command)).rejects.toMatchObject({ type: "denied" });
    expect(await snapshot()).toEqual(before);
  });

  it.each(["labels", "audit"])("rolls back the entire clone when %s insertion fails", async (failure) => {
    const { board, lists } = await fixture();
    const before = await snapshot();
    if (failure === "audit") {
      vi.spyOn(audit, "writeAudit").mockRejectedValue(new Error("audit unavailable"));
    } else {
      vi.spyOn(audit, "transaction").mockImplementation(<T>(fn: (tx: audit.Tx) => Promise<T>) =>
        runTransaction(async (tx) => {
          vi.spyOn(tx.cardLabel, "createMany").mockRejectedValueOnce(new Error("labels unavailable"));
          return fn(tx);
        }),
      );
    }
    await expect(cloneList(owner(), { id: lists.todo.id, boardId: board.id })).rejects.toThrow(`${failure} unavailable`);
    expect(await snapshot()).toEqual(before);
  });
});
