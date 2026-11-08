import { afterEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase } from "../setup/test-db";
import { agent, member, seedBoard } from "../setup/fixtures";
import * as audit from "@/lib/domain/audit";
import { deleteBoard, deleteCard, deleteLabel, deleteList } from "@/lib/domain/deletes";
import { createCard } from "@/lib/domain/cards";
import { addComment } from "@/lib/domain/comments";
import { getChanges } from "@/lib/domain/changes";
import { db } from "@/lib/db";

afterEach(() => vi.restoreAllMocks());
describe.skipIf(!hasTestDatabase)("transactional hard deletes", () => {
  it.each([
    ["CARD", deleteCard], ["LIST", deleteList],
    ["BOARD", deleteBoard], ["LABEL", deleteLabel],
  ] as const)("%s: preserves scope, rolls back cascades on audit failure and retains history on success", async (entityType, remove) => {
    const actor = member();
    const { board, lists } = await seedBoard(actor);
    const label = await db.label.create({ data: { orgId: actor.orgId, name: "Review", color: "red" } });
    const input = { listId: lists.todo.id, title: "Demo card", externalKey: "demo-card", labelIds: [label.id] };
    const { card } = await createCard(actor, input);
    await addComment(actor, { cardId: card.id, body: "Demo note", externalKey: "demo-note" });
    const ids = { CARD: card.id, LIST: lists.todo.id, BOARD: board.id, LABEL: label.id };
    const command = { id: ids[entityType], boardId: board.id };
    const snapshot = async () => ({
      boards: await db.board.findMany(),
      lists: await db.list.findMany({ orderBy: { id: "asc" } }),
      cards: await db.card.findMany(),
      labels: await db.label.findMany(),
      links: await db.cardLabel.findMany(),
      comments: await db.comment.findMany(),
      receipts: await db.externalKey.findMany({ orderBy: { id: "asc" } }),
      history: await db.auditLog.findMany({ orderBy: { eventId: "asc" } }),
    });
    const before = await snapshot();
    const cursor = (await getChanges(actor)).nextCursor;
    await expect(remove(member("other"), command)).rejects.toThrow();
    await expect(remove(agent(), command)).rejects.toMatchObject({ type: "denied" });
    if (entityType === "LIST") {
      await expect(deleteList(actor, { ...command, boardId: "other-board" })).rejects.toThrow();
    }
    expect(await snapshot()).toEqual(before);

    const fault = vi.spyOn(audit, "writeAudit").mockRejectedValue(new Error("audit unavailable"));
    await expect(remove(actor, command)).rejects.toThrow("audit unavailable");
    expect(await snapshot()).toEqual(before);
    fault.mockRestore();

    await remove(actor, command);
    const after = await snapshot();
    expect(after.receipts).toEqual(before.receipts);
    expect(after.history.slice(0, before.history.length)).toEqual(before.history);
    expect((await getChanges(actor, { cursor })).events).toMatchObject([
      { action: "DELETE", entityType, entityId: command.id, actor: { kind: "MEMBER" } },
    ]);
    expect(after.links).toEqual([]);
    expect(after.boards).toHaveLength(entityType === "BOARD" ? 0 : 1);
    expect(after.lists).toHaveLength(entityType === "BOARD" ? 0 : entityType === "LIST" ? 2 : 3);
    expect(after.labels).toHaveLength(entityType === "LABEL" ? 0 : 1);
    expect(after.cards).toHaveLength(entityType === "LABEL" ? 1 : 0);
    expect(after.comments).toHaveLength(entityType === "LABEL" ? 1 : 0);
    if (entityType !== "LABEL") {
      await expect(createCard(actor, input)).rejects.toMatchObject({ type: "not_found" });
      expect(await db.card.count()).toBe(0);
    }
  });
});
