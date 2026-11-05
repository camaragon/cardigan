import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetClerk } from "../setup/mock-clerk";
import { hasTestDatabase } from "../setup/test-db";
import { owner, seedBoard } from "../setup/fixtures";

vi.mock("@clerk/nextjs/server", async () =>
  (await import("../setup/mock-clerk")).clerkServerMock,
);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// UI drags call the move-card server action: one audited single-card move.
describe.skipIf(!hasTestDatabase)("UI moves", async () => {
  const { db } = await import("@/lib/db");
  const { moveCard } = await import("@/actions/move-card");
  const { createCard: createCardAction } = await import("@/actions/create-card");

  beforeEach(() => resetClerk());

  it("C-6: a UI drag is one single-card move with source, target and position", async () => {
    const { board, lists } = await seedBoard(owner());
    const a = await createCardAction({ boardId: board.id, listId: lists.todo.id, title: "Card A" });
    const b = await createCardAction({ boardId: board.id, listId: lists.todo.id, title: "Card B" });

    expect((await moveCard({ id: b.data!.id, boardId: board.id, toListId: lists.todo.id, position: 0 })).error).toBeUndefined();
    expect((await moveCard({ id: a.data!.id, boardId: board.id, toListId: lists.doing.id, position: 0 })).error).toBeUndefined();

    const moves = await db.auditLog.findMany({ where: { action: "MOVE" }, orderBy: { eventId: "asc" } });
    expect(moves.map((m) => [m.entityId, m.fromListId, m.toListId, m.position, m.surface])).toEqual([
      [b.data!.id, lists.todo.id, lists.todo.id, 0, "UI"],
      [a.data!.id, lists.todo.id, lists.doing.id, 0, "UI"],
    ]);
    // A reorder keeps the version; a move to another list bumps it.
    const [cardA, cardB] = await Promise.all([
      db.card.findUniqueOrThrow({ where: { id: a.data!.id } }),
      db.card.findUniqueOrThrow({ where: { id: b.data!.id } }),
    ]);
    expect([cardA.version, cardB.version]).toEqual([2, 1]);
  });

  it("a move only targets lists in the actor's workspace", async () => {
    const { board, lists } = await seedBoard(owner());
    const other = await seedBoard(owner("org_other", "user_other"));
    const card = await createCardAction({ boardId: board.id, listId: lists.todo.id, title: "Mine" });

    const result = await moveCard({ id: card.data!.id, boardId: board.id, toListId: other.lists.todo.id, position: 0 });
    expect(result.error).toBe("List not found");
    expect((await db.card.findUniqueOrThrow({ where: { id: card.data!.id } })).listId).toBe(lists.todo.id);
  });
});
