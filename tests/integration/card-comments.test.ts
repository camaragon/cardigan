import { describe, expect, it, vi } from "vitest";
import { hasTestDatabase } from "../setup/test-db";
import { agent, owner, seedBoard } from "../setup/fixtures";

vi.mock("@clerk/nextjs/server", async () =>
  (await import("../setup/mock-clerk")).clerkServerMock,
);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe.skipIf(!hasTestDatabase)("card comments and duplicates", async () => {
  const { db } = await import("@/lib/db");
  const cards = await import("@/lib/domain/cards");
  const { addComment, markDuplicate } = await import("@/lib/domain/comments");
  const { addComment: addCommentAction } = await import("@/actions/add-comment");

  it("C-3: a comment retried with the same key and body is added once", async () => {
    const { lists } = await seedBoard(owner());
    const { card } = await cards.createCard(agent(), { listId: lists.todo.id, title: "Card", externalKey: "c" });
    const first = await addComment(agent(), { cardId: card.id, body: "Progress", externalKey: "note-1" });
    const again = await addComment(agent(), { cardId: card.id, body: "Progress", externalKey: "note-1" });
    expect(again).toMatchObject({ created: false, comment: { id: first.comment.id } });
    expect(await db.comment.count()).toBe(1);
    await expect(addComment(agent(), { cardId: card.id, body: "Other", externalKey: "note-1" })).rejects.toMatchObject({ type: "conflict" });
  });

  it("marks a duplicate with a comment and deletes neither card; people comment through the action", async () => {
    const { board, lists } = await seedBoard(owner());
    const { card: a } = await cards.createCard(agent(), { listId: lists.todo.id, title: "A" });
    const { card: b } = await cards.createCard(agent(), { listId: lists.done.id, title: "B" });

    const dup = await markDuplicate(agent(), { cardId: b.id, canonicalCardId: a.id, externalKey: "d1" });
    expect(dup.comment).toMatchObject({ kind: "DUPLICATE", duplicateOfCardId: a.id, actorKind: "AGENT" });
    expect(await db.card.count()).toBe(2);

    const result = await addCommentAction({ cardId: a.id, boardId: board.id, body: "x" });
    expect(result.data).toMatchObject({ body: "x", actorKind: "OWNER", surface: "UI" });
  });
});
