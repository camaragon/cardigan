import { describe, expect, it, vi } from "vitest";
import { hasTestDatabase } from "../setup/test-db";
import { owner, roleActor, seedBoard } from "../setup/fixtures";

vi.mock("@clerk/nextjs/server", async () =>
  (await import("../setup/mock-clerk")).clerkServerMock,
);

describe.skipIf(!hasTestDatabase)("card comments and duplicates", async () => {
  const { db } = await import("@/lib/db");
  const cards = await import("@/lib/domain/cards");
  const { addComment, markDuplicate } = await import("@/lib/domain/comments");

  it("P-3: PM proposes, edits and marks duplicates in Proposed and comments anywhere; only the supervisor moves work through", async () => {
    const { lists } = await seedBoard(owner(), "product");
    const pm = await roleActor("pm");
    const supervisor = await roleActor("supervisor");

    const { card: a } = await cards.createCard(pm, { listId: lists.proposed.id, title: "A", externalKey: "a" });
    const { card: b } = await cards.createCard(pm, { listId: lists.proposed.id, title: "B", externalKey: "b" });
    await expect(cards.createCard(pm, { listId: lists.waiting_on_owner.id, title: "W", externalKey: "w" })).rejects.toMatchObject({ type: "denied" });
    await cards.updateCard(pm, { cardId: a.id, title: "A edited" });

    const { card: queued } = await cards.createCard(owner(), { listId: lists.queued.id, title: "Queued work" });
    await expect(cards.updateCard(pm, { cardId: queued.id, title: "x" })).rejects.toMatchObject({ type: "denied" });
    await expect(markDuplicate(pm, { cardId: queued.id, canonicalCardId: a.id })).rejects.toMatchObject({ type: "denied" });
    // The duplicate must be editable; the canonical card may be in any list.
    const dup = await markDuplicate(pm, { cardId: b.id, canonicalCardId: queued.id, externalKey: "d1" });
    expect(dup.comment).toMatchObject({ kind: "DUPLICATE", duplicateOfCardId: queued.id });
    expect(await db.card.count({ where: { id: { in: [b.id, queued.id] } } })).toBe(2);
    await addComment(pm, { cardId: queued.id, body: "Note on queued work", externalKey: "c1" });

    // Moves: PM cannot move; supervisor moves Queued -> In flight -> Done.
    await expect(cards.moveCard(pm, { cardId: queued.id, toListId: lists.in_flight.id })).rejects.toMatchObject({ type: "denied" });
    await cards.moveCard(supervisor, { cardId: queued.id, toListId: lists.in_flight.id });
    await cards.moveCard(supervisor, { cardId: queued.id, toListId: lists.done.id });
    await expect(cards.moveCard(supervisor, { cardId: a.id, toListId: lists.queued.id })).rejects.toMatchObject({ type: "denied" });

    // Supervisor creates and edits Waiting on owner cards keyed by task and question.
    const { card: q } = await cards.createCard(supervisor, { listId: lists.waiting_on_owner.id, title: "Question", externalKey: "task-42:q1" });
    await cards.updateCard(supervisor, { cardId: q.id, description: "More context" });
    await expect(cards.updateCard(pm, { cardId: q.id, title: "x" })).rejects.toMatchObject({ type: "denied" });
    await expect(cards.createCard(supervisor, { listId: lists.proposed.id, title: "S", externalKey: "s" })).rejects.toMatchObject({ type: "denied" });
  });

  it("C-3: a comment retried with the same key and body is added once", async () => {
    const { lists } = await seedBoard(owner(), "plain");
    const agent = await roleActor("agent");
    const { card } = await cards.createCard(agent, { listId: lists.todo.id, title: "Card", externalKey: "c" });
    const first = await addComment(agent, { cardId: card.id, body: "Progress", externalKey: "note-1" });
    const again = await addComment(agent, { cardId: card.id, body: "Progress", externalKey: "note-1" });
    expect(again).toMatchObject({ created: false, comment: { id: first.comment.id } });
    expect(await db.comment.count()).toBe(1);
    await expect(addComment(agent, { cardId: card.id, body: "Other", externalKey: "note-1" })).rejects.toMatchObject({ type: "conflict" });
  });
});
