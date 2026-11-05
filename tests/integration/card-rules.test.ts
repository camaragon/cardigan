import { beforeEach, describe, expect, it, vi } from "vitest";
import { clerkState, resetClerk } from "../setup/mock-clerk";
import { hasTestDatabase } from "../setup/test-db";
import { member, owner, roleActor, seedBoard } from "../setup/fixtures";

vi.mock("@clerk/nextjs/server", async () =>
  (await import("../setup/mock-clerk")).clerkServerMock,
);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Card rules through the shared domain functions. People act through the
// server actions where the UI is the point; agents are role actors.
describe.skipIf(!hasTestDatabase)("card rules", async () => {
  const { db } = await import("@/lib/db");
  const cards = await import("@/lib/domain/cards");
  const { updateCard: updateCardAction } = await import("@/actions/update-card");
  const { createCard: createCardAction } = await import("@/actions/create-card");

  beforeEach(() => resetClerk());

  const asMember = () => {
    clerkState.userId = "user_member";
    clerkState.orgRole = "org:member";
  };

  it("C-3: same key and payload return one card and one create entry; a different payload conflicts; roles' keys never collide", async () => {
    const { lists } = await seedBoard(owner(), "product");
    const pm = await roleActor("pm");
    const supervisor = await roleActor("supervisor");
    const input = { listId: lists.proposed.id, title: "Idea", externalKey: "task-1" };

    const first = await cards.createCard(pm, input);
    const again = await cards.createCard(pm, input);
    expect(again.card.id).toBe(first.card.id);
    expect(again.created).toBe(false);
    expect(await db.card.count()).toBe(1);
    expect(await db.auditLog.count({ where: { action: "CREATE", entityType: "CARD" } })).toBe(1);

    await expect(cards.createCard(pm, { ...input, title: "Different" })).rejects.toMatchObject({ type: "conflict" });

    const other = await cards.createCard(supervisor, {
      listId: lists.waiting_on_owner.id,
      title: "Question 1",
      externalKey: "task-1",
    });
    expect(other.created).toBe(true);
    expect(other.card.id).not.toBe(first.card.id);
  });

  it("C-3: a stale update or move is refused with the current card and its last actor", async () => {
    const { lists } = await seedBoard(owner(), "plain");
    const agent = await roleActor("agent");
    const { card } = await cards.createCard(agent, { listId: lists.todo.id, title: "Card", externalKey: "c" });
    await cards.updateCard(member(), { cardId: card.id, title: "Edited by member" });

    const stale = await cards
      .updateCard(agent, { cardId: card.id, title: "Mine", expectedVersion: 1 })
      .catch((e) => e);
    expect(stale.type).toBe("stale_version");
    expect(stale.details.current).toMatchObject({ title: "Edited by member", version: 2 });
    expect(stale.details.lastActor).toMatchObject({ kind: "MEMBER", surface: "UI" });

    const staleMove = await cards
      .moveCard(agent, { cardId: card.id, toListId: lists.done.id, expectedVersion: 1 })
      .catch((e) => e);
    expect(staleMove.type).toBe("stale_version");
    expect((await db.card.findUniqueOrThrow({ where: { id: card.id } })).listId).toBe(lists.todo.id);
  });

  it("C-8: on a plain board any member or agent creates in and moves to any list", async () => {
    const plain = await seedBoard(owner(), "plain");
    const agent = await roleActor("agent");
    asMember();
    const memberCard = await createCardAction({ boardId: plain.board.id, listId: plain.lists.done.id, title: "Member card" });
    expect(memberCard.error).toBeUndefined();

    const { card } = await cards.createCard(agent, { listId: plain.lists.doing.id, title: "Agent card", externalKey: "p1" });
    for (const target of [plain.lists.done, plain.lists.todo]) {
      await cards.moveCard(agent, { cardId: card.id, toListId: target.id });
      await cards.moveCard(member(), { cardId: memberCard.data!.id, toListId: target.id });
    }
  });

  it("P-2: only the owner creates in, moves into, reorders or edits Queued and In flight; denied attempts change nothing", async () => {
    const { board, lists } = await seedBoard(owner(), "product");
    const actors = [member(), await roleActor("pm"), await roleActor("supervisor")];

    const { card: proposal } = await cards.createCard(owner(), { listId: lists.proposed.id, title: "P" });
    const { card: q1 } = await cards.createCard(owner(), { listId: lists.queued.id, title: "Q1" });
    const { card: q2 } = await cards.createCard(owner(), { listId: lists.queued.id, title: "Q2" });
    await cards.moveCard(owner(), { cardId: q2.id, toListId: lists.queued.id, position: 0 });
    const snapshot = async () => JSON.stringify(await db.card.findMany({ orderBy: { id: "asc" } }));
    const before = await snapshot();

    for (const actor of actors) {
      for (const listId of [lists.queued.id, lists.in_flight.id, lists.done.id]) {
        await expect(cards.createCard(actor, { listId, title: "Nope", externalKey: "n" })).rejects.toMatchObject({ type: "denied" });
      }
      await expect(cards.moveCard(actor, { cardId: proposal.id, toListId: lists.queued.id })).rejects.toMatchObject({ type: "denied" });
      await expect(cards.moveCard(actor, { cardId: proposal.id, toListId: lists.in_flight.id })).rejects.toMatchObject({ type: "denied" });
      await expect(cards.moveCard(actor, { cardId: q1.id, toListId: lists.queued.id, position: 0 })).rejects.toMatchObject({ type: "denied" });
      await expect(cards.updateCard(actor, { cardId: q1.id, title: "Rewritten" })).rejects.toMatchObject({ type: "denied" });
    }
    // The owner cannot skip Queued either.
    await expect(cards.moveCard(owner(), { cardId: proposal.id, toListId: lists.in_flight.id })).rejects.toMatchObject({ type: "denied" });
    await expect(cards.createCard(owner(), { listId: lists.in_flight.id, title: "Direct" })).rejects.toMatchObject({ type: "denied" });
    expect(await snapshot()).toBe(before);

    // In the UI, the owner edits queued work and a member is refused.
    const edited = await updateCardAction({ id: q1.id, boardId: board.id, title: "Owner edit" });
    expect(edited.error).toBeUndefined();
    asMember();
    const memberEdit = await updateCardAction({ id: q1.id, boardId: board.id, title: "Member edit" });
    expect(memberEdit.error).toMatch(/Not allowed/);
    const memberCreate = await createCardAction({ boardId: board.id, listId: lists.queued.id, title: "Member queue" });
    expect(memberCreate.error).toMatch(/Not allowed/);
  });
});
