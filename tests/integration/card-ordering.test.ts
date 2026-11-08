import { describe, expect, it, vi } from "vitest";
import { hasTestDatabase } from "../setup/test-db";
import { owner, seedBoard } from "../setup/fixtures";

vi.mock("@clerk/nextjs/server", async () =>
  (await import("../setup/mock-clerk")).clerkServerMock,
);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe.skipIf(!hasTestDatabase)("serialized card ordering", async () => {
  const { db } = await import("@/lib/db");
  const { transaction } = await import("@/lib/domain/audit");
  const { lockBoardOrder } = await import("@/lib/domain/ordering");
  const { createCard, copyCard, moveCard } = await import("@/lib/domain/cards");
  const actor = owner();

  // Queue real transactions at the shared lock in a controlled order.
  async function queued(boardId: string, operations: (() => Promise<unknown>)[]) {
    let release!: () => void;
    let acquired!: () => void;
    const held = new Promise<void>((resolve) => { acquired = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const blocker = transaction(async (tx) => {
      await lockBoardOrder(tx, boardId);
      acquired();
      await gate;
    });
    const pending: Promise<unknown>[] = [];
    try {
      await held;
      for (const operation of operations) {
        pending.push(operation());
        // Observe database lock waiters, not elapsed time or scheduler luck.
        await expect.poll(async () => {
          const [row] = await db.$queryRaw<{ count: number }[]>`
            SELECT count(*)::int AS count FROM pg_locks
            WHERE locktype = 'advisory' AND classid = 1 AND objsubid = 2
              AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
              AND NOT granted
          `;
          return row.count;
        }).toBe(pending.length);
      }
    } finally {
      release();
      await blocker;
      await Promise.allSettled(pending);
    }
    return Promise.all(pending);
  }

  const ordered = (listId: string) => db.card.findMany({
    where: { listId }, orderBy: [{ order: "asc" }, { id: "asc" }],
  });

  it("serializes appends, copies and opposite moves with complete events and no deadlock", async () => {
    const { board, lists } = await seedBoard(actor);
    const { card: a } = await createCard(actor, { listId: lists.todo.id, title: "A" });
    const { card: b } = await createCard(actor, { listId: lists.doing.id, title: "B" });
    const before = await db.auditLog.count();
    await queued(board.id, [
      () => createCard(actor, { listId: lists.todo.id, title: "C", externalKey: "c" }),
      () => createCard(actor, { listId: lists.todo.id, title: "D", externalKey: "d" }),
      () => copyCard(actor, a.id),
    ]);
    await queued(board.id, [
      () => moveCard(actor, { cardId: a.id, toListId: lists.doing.id, expectedVersion: 1 }),
      () => moveCard(actor, { cardId: b.id, toListId: lists.todo.id, position: 0, expectedVersion: 1 }),
      () => moveCard(actor, { cardId: b.id, toListId: lists.todo.id, position: 1 }),
    ]);
    const todo = await ordered(lists.todo.id);
    expect(todo.map((c) => [c.title, c.order, c.version])).toEqual([
      ["C", 0, 1], ["B", 1, 2], ["D", 2, 1], ["A (Clone)", 3, 1],
    ]);
    expect((await ordered(lists.doing.id)).map((c) => [c.id, c.order, c.version]))
      .toEqual([[a.id, 0, 2]]);
    const events = await db.auditLog.findMany({ orderBy: { eventId: "asc" }, skip: before });
    expect(events.map((e) => e.action)).toEqual(["CREATE", "CREATE", "CREATE", "MOVE", "MOVE", "MOVE"]);
    expect(events.map((e) => e.eventId)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(events.slice(3).map((e) => [e.cardId, e.fromListId, e.toListId, e.position])).toEqual([
      [a.id, lists.todo.id, lists.doing.id, 1],
      [b.id, lists.doing.id, lists.todo.id, 0],
      [b.id, lists.todo.id, lists.todo.id, 1],
    ]);
  });

  it("refuses a queued stale cross-list move without another event", async () => {
    const { board, lists } = await seedBoard(actor);
    const { card } = await createCard(actor, { listId: lists.todo.id, title: "A" });
    const results = await queued(board.id, [
      () => moveCard(actor, { cardId: card.id, toListId: lists.doing.id, expectedVersion: 1 }),
      () => moveCard(actor, { cardId: card.id, toListId: lists.done.id, expectedVersion: 1 })
        .catch((error) => error),
    ]);
    expect(results[1]).toMatchObject({ type: "stale_version" });
    expect((await ordered(lists.doing.id))[0]).toMatchObject({ id: card.id, version: 2 });
    expect(await db.auditLog.count({ where: { action: "MOVE" } })).toBe(1);
  });

  it("breaks existing position ties by id without bumping sibling versions", async () => {
    const { lists } = await seedBoard(actor);
    await db.card.createMany({ data: ["c", "b", "a"].map((id) => ({
      id, title: id, order: 1, listId: lists.todo.id,
    })) });
    await moveCard(actor, { cardId: "c", toListId: lists.todo.id, position: 0 });
    expect((await ordered(lists.todo.id)).map((c) => [c.id, c.order, c.version]))
      .toEqual([["c", 0, 1], ["a", 1, 1], ["b", 2, 1]]);
  });

  it("serializes list append, clone and reorder with stable cloned positions and labels", async () => {
    const { createList } = await import("@/actions/create-list");
    const { cloneList } = await import("@/actions/clone-list");
    const { updateListOrder } = await import("@/actions/update-list-order");
    const { board, lists } = await seedBoard(actor);
    await db.card.createMany({ data: ["b", "a"].map((id) => ({
      id, title: id, order: 1, listId: lists.todo.id,
    })) });
    const label = await db.label.create({ data: { orgId: actor.orgId, name: "Urgent", color: "red" } });
    await db.cardLabel.create({ data: { cardId: "b", labelId: label.id } });
    const results = await queued(board.id, [
      // Reorder the complete snapshot before the queued appends add new lists.
      () => updateListOrder({ boardId: board.id, lists: [
        { ...lists.todo, order: 2 },
        { ...lists.doing, order: 1 },
        { ...lists.done, order: 3 },
      ] }),
      () => createList({ boardId: board.id, title: "Extra" }),
      () => cloneList({ boardId: board.id, id: lists.todo.id }),
    ]);
    for (const result of results) expect(result).toHaveProperty("data");
    const orderedLists = await db.list.findMany({ where: { boardId: board.id }, orderBy: { order: "asc" } });
    expect(orderedLists.map((l) => [l.title, l.order])).toEqual([
      ["Doing", 1], ["To do", 2], ["Done", 3], ["Extra", 4], ["To do - Clone", 5],
    ]);
    const copies = await db.card.findMany({
      where: { listId: orderedLists[4].id }, orderBy: { order: "asc" }, include: { labels: true },
    });
    expect(copies.map((c) => [c.title, c.order, c.labels.map((l) => l.labelId)]))
      .toEqual([["a", 0, []], ["b", 1, [label.id]]]);
  });
});
