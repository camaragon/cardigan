import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createBoard, updateBoard } from "@/lib/domain/boards";
import { copyCard, createCard, moveCard } from "@/lib/domain/cards";
import { cloneList } from "@/lib/domain/lists";
import { deleteCard } from "@/lib/domain/deletes";
import { agent, member, owner, seedBoard } from "../setup/fixtures";
import { hasTestDatabase } from "../setup/test-db";

describe.skipIf(!hasTestDatabase)("board card numbers", () => {
  it("allocates distinct sequential numbers for concurrent UI and agent creates", async () => {
    const { board, lists } = await seedBoard(owner());
    await updateBoard(owner(), { id: board.id, keyPrefix: "DEMO" });
    const cards = await Promise.all(Array.from({ length: 8 }, (_, i) =>
      createCard(i % 2 ? agent() : owner(), { listId: lists.todo.id, title: `Task ${i}` }),
    ));
    expect(cards.map(({ card }) => card.number).sort((a, b) => a! - b!)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("backfills by creation time then id, and new and copied cards continue after", async () => {
    const { board, lists } = await seedBoard(owner());
    const at = new Date("2026-01-01");
    await db.card.createMany({ data: [
      { id: "b", title: "Second", listId: lists.todo.id, order: 0, createdAt: at, updatedAt: at, version: 3 },
      { id: "a", title: "First", listId: lists.doing.id, order: 9, createdAt: at },
      { id: "c", title: "Third", listId: lists.todo.id, order: 1, createdAt: new Date("2026-01-02") },
    ] });
    const editState = () => db.card.findMany({
      orderBy: { id: "asc" }, select: { id: true, updatedAt: true, version: true },
    });
    const before = await editState();
    await updateBoard(member(), { id: board.id, keyPrefix: "DEMO" });
    expect(await editState()).toEqual(before);
    expect((await db.card.findMany({ orderBy: { id: "asc" } })).map(c => c.number)).toEqual([1, 2, 3]);
    const { card } = await createCard(owner(), { listId: lists.todo.id, title: "Fourth" });
    expect(card.number).toBe(4);
    expect((await copyCard(owner(), card.id)).number).toBe(5);
    const cloned = await cloneList(owner(), { id: lists.doing.id, boardId: board.id });
    expect(cloned.cards[0].number).toBe(6);
    expect((await moveCard(owner(), { cardId: card.id, toListId: lists.done.id })).number).toBe(4);
  });

  it("changes the prefix without changing numbers, reserves aliases and allows switching back", async () => {
    const { board, lists } = await seedBoard(owner());
    await updateBoard(member(), { id: board.id, keyPrefix: "DEMO" });
    const { card } = await createCard(owner(), { listId: lists.todo.id, title: "Task" });
    await updateBoard(member(), { id: board.id, keyPrefix: "ABC" });
    expect((await db.card.findUniqueOrThrow({ where: { id: card.id } })).number).toBe(1);
    expect((await db.boardKeyPrefix.findMany({ where: { boardId: board.id } })).map(p => p.prefix).sort()).toEqual(["ABC", "DEMO"]);
    const other = await seedBoard(owner());
    for (const keyPrefix of ["DEMO", "ABC"]) {
      await expect(updateBoard(owner(), { id: other.board.id, keyPrefix })).rejects.toMatchObject({
        type: "conflict", message: "This prefix belongs to another board in this workspace",
      });
    }
    expect((await updateBoard(member(), { id: board.id, keyPrefix: "DEMO" })).keyPrefix).toBe("DEMO");
    expect(await db.auditLog.findFirst({ where: { entityId: board.id }, orderBy: { eventId: "desc" } }))
      .toMatchObject({ action: "UPDATE", entityTitle: board.title });
  });

  it("never frees a deleted card's number", async () => {
    const { board, lists } = await seedBoard(owner());
    await updateBoard(owner(), { id: board.id, keyPrefix: "DEMO" });
    const { card } = await createCard(owner(), { listId: lists.todo.id, title: "Deleted" });
    await deleteCard(owner(), { id: card.id });
    expect((await createCard(owner(), { listId: lists.todo.id, title: "Next" })).card.number).toBe(2);
  });

  it("keeps prefix changes within person and workspace authority and validates the namespace", async () => {
    const { board } = await seedBoard(owner());
    await expect(updateBoard(agent(), { id: board.id, keyPrefix: "DEMO" })).rejects.toMatchObject({ type: "denied" });
    await expect(updateBoard(owner("other"), { id: board.id, keyPrefix: "DEMO" })).rejects.toThrow();
    for (const keyPrefix of ["", "x", "lower", "1ABC", "TOOLONGPREFIX"]) {
      await expect(updateBoard(owner(), { id: board.id, keyPrefix })).rejects.toMatchObject({ type: "invalid" });
    }
    await updateBoard(owner(), { id: board.id, keyPrefix: "DEMO" });
    await expect(createBoard(owner(), {
      title: "Invalid prefix", keyPrefix: "bad",
      image: { imageId: "demo", imageThumbUrl: "thumb", imageFullUrl: "full", imageUserName: "demo", imageLinkHTML: "link" },
    })).rejects.toMatchObject({ type: "invalid" });
    const other = await seedBoard(owner("other"));
    expect((await updateBoard(owner("other"), { id: other.board.id, keyPrefix: "DEMO" })).keyPrefix).toBe("DEMO");
  });
});
