import { beforeEach, describe, expect, it, vi } from "vitest";
import { clerkState, resetClerk } from "../setup/mock-clerk";
import { hasTestDatabase } from "../setup/test-db";
import { agent, member, owner, seedBoard } from "../setup/fixtures";

vi.mock("@clerk/nextjs/server", async () =>
  (await import("../setup/mock-clerk")).clerkServerMock,
);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Card changes through the shared domain functions. People act through the
// server actions where the UI is the point; agents call the domain directly.
describe.skipIf(!hasTestDatabase)("card changes", async () => {
  const { db } = await import("@/lib/db");
  const cards = await import("@/lib/domain/cards");
  const { createCard: createCardAction } = await import("@/actions/create-card");
  const { cloneCard } = await import("@/actions/clone-card");

  beforeEach(() => resetClerk());

  it("C-3: same key and payload return one card and one create entry; a different payload conflicts; scopes' keys never collide", async () => {
    const { lists } = await seedBoard(owner());
    const input = { listId: lists.todo.id, title: "Idea", externalKey: "task-1" };

    const first = await cards.createCard(agent(), input);
    const again = await cards.createCard(agent(), input);
    expect(again.card.id).toBe(first.card.id);
    expect(again.created).toBe(false);
    expect(await db.card.count()).toBe(1);
    expect(await db.auditLog.count({ where: { action: "CREATE", entityType: "CARD" } })).toBe(1);

    await expect(cards.createCard(agent(), { ...input, title: "Different" })).rejects.toMatchObject({ type: "conflict" });

    const other = await cards.createCard(owner(), input);
    expect(other.created).toBe(true);
    expect(other.card.id).not.toBe(first.card.id);
  });

  it("C-3: a stale update or move is refused with the current card and its last actor", async () => {
    const { lists } = await seedBoard(owner());
    const { card } = await cards.createCard(agent(), { listId: lists.todo.id, title: "Card", externalKey: "c" });
    await cards.updateCard(member(), { cardId: card.id, title: "Edited by member" });

    const stale = await cards
      .updateCard(agent(), { cardId: card.id, title: "Mine", expectedVersion: 1 })
      .catch((e) => e);
    expect(stale.type).toBe("stale_version");
    expect(stale.details.current).toMatchObject({ title: "Edited by member", version: 2 });
    expect(stale.details.lastActor).toMatchObject({ kind: "MEMBER", surface: "UI" });

    const staleMove = await cards
      .moveCard(agent(), { cardId: card.id, toListId: lists.done.id, expectedVersion: 1 })
      .catch((e) => e);
    expect(staleMove.type).toBe("stale_version");
    expect((await db.card.findUniqueOrThrow({ where: { id: card.id } })).listId).toBe(lists.todo.id);
  });

  it("C-8: on a plain board any member or agent creates in and moves to any list", async () => {
    const { board, lists } = await seedBoard(owner());
    clerkState.userId = "user_member";
    clerkState.orgRole = "org:member";
    const memberCard = await createCardAction({ boardId: board.id, listId: lists.done.id, title: "M" });
    expect(memberCard.error).toBeUndefined();

    const { card } = await cards.createCard(agent(), { listId: lists.doing.id, title: "A", externalKey: "p1" });
    for (const target of [lists.done, lists.todo]) {
      await cards.moveCard(agent(), { cardId: card.id, toListId: target.id });
      await cards.moveCard(member(), { cardId: memberCard.data!.id, toListId: target.id });
    }
  });

  it("copies a card with its labels in one create entry", async () => {
    const { board, lists } = await seedBoard(owner());
    const label = await db.label.create({ data: { name: "Bug", color: "#f00", orgId: "org_test" } });
    const { card } = await cards.createCard(owner(), { listId: lists.todo.id, title: "Source" });
    await cards.setCardLabel(owner(), { cardId: card.id, labelId: label.id, assigned: true });

    const copy = await cloneCard({ id: card.id, boardId: board.id });
    expect(copy.error).toBeUndefined();
    expect(await db.cardLabel.count({ where: { cardId: copy.data!.id } })).toBe(1);
    expect(await db.auditLog.count({ where: { entityId: copy.data!.id, action: "CREATE" } })).toBe(1);
  });
});
