import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
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

  it.each([
    { legacy: false, note: "Same issue" },
    { legacy: true, note: "Same issue" },
    { legacy: true, note: undefined },
  ])("replays duplicate intent after rename and refuses changed intent or deleted targets (legacy: $legacy, note: $note)", async ({ legacy, note }) => {
    const { lists } = await seedBoard(owner());
    const { card: canonical } = await cards.createCard(agent(), { listId: lists.todo.id, title: "Original" });
    const { card: source } = await cards.createCard(agent(), { listId: lists.todo.id, title: "Duplicate" });
    const input = { cardId: source.id, canonicalCardId: canonical.id, note, externalKey: "duplicate-1" };
    const first = await markDuplicate(agent(), input);
    if (legacy) {
      const payloadHash = createHash("sha256").update(JSON.stringify({
        cardId: source.id, body: first.comment.body, kind: "DUPLICATE", duplicateOfCardId: canonical.id,
      })).digest("hex");
      await db.externalKey.updateMany({ where: { entityId: first.comment.id }, data: { payloadHash } });
    }
    const receipt = await db.externalKey.findFirstOrThrow({ where: { entityId: first.comment.id } });
    const auditCount = await db.auditLog.count();
    await db.card.update({ where: { id: canonical.id }, data: { title: "Renamed" } });
    expect(await markDuplicate(agent(), input)).toEqual({ created: false, comment: first.comment });
    for (const note of ["Different", first.comment.body]) {
      await expect(markDuplicate(agent(), { ...input, note })).rejects.toMatchObject({ type: "conflict" });
    }
    expect(await db.externalKey.findUnique({ where: { id: receipt.id } })).toEqual(receipt);
    expect(await db.auditLog.count()).toBe(auditCount);
    expect(await db.comment.count()).toBe(1);
    await db.card.delete({ where: { id: canonical.id } });
    await expect(markDuplicate(agent(), input)).rejects.toMatchObject({
      type: "not_found", message: "Original canonical card no longer exists",
    });
    expect(await db.card.count()).toBe(1);
    expect(await db.comment.count()).toBe(1);
    await db.card.delete({ where: { id: source.id } });
    await expect(markDuplicate(agent(), input)).rejects.toMatchObject({
      type: "not_found", message: "Original comment target no longer exists",
    });
    expect(await db.card.count()).toBe(0);
    expect(await db.comment.count()).toBe(0);
  });

  it("conflicts rather than guessing the note in an ambiguous legacy duplicate body", async () => {
    const { lists } = await seedBoard(owner());
    const { card: canonical } = await cards.createCard(agent(), { listId: lists.todo.id, title: "Canonical" });
    const { card: source } = await cards.createCard(agent(), { listId: lists.todo.id, title: "Duplicate" });
    await db.card.update({ where: { id: canonical.id }, data: { title: `Title" (${canonical.id}): embedded` } });
    const input = { cardId: source.id, canonicalCardId: canonical.id, externalKey: "ambiguous" };
    const { comment } = await markDuplicate(agent(), input);
    const payloadHash = createHash("sha256").update(JSON.stringify({
      cardId: source.id, body: comment.body, kind: "DUPLICATE", duplicateOfCardId: canonical.id,
    })).digest("hex");
    await db.externalKey.updateMany({ where: { entityId: comment.id }, data: { payloadHash } });
    await expect(markDuplicate(agent(), { ...input, note: `embedded" (${canonical.id})` }))
      .rejects.toMatchObject({ type: "conflict" });
    expect(await db.comment.count()).toBe(1);
  });

  it("returns a typed failure when replaying a comment whose source was deleted", async () => {
    const { lists } = await seedBoard(owner());
    const { card } = await cards.createCard(agent(), { listId: lists.todo.id, title: "Card" });
    const input = { cardId: card.id, body: "Progress", externalKey: "deleted-comment" };
    await addComment(agent(), input);
    await db.card.delete({ where: { id: card.id } });
    await expect(addComment(agent(), input)).rejects.toMatchObject({
      type: "not_found", message: "Original comment target no longer exists",
    });
    expect(await db.card.count()).toBe(0);
    expect(await db.comment.count()).toBe(0);
  });
});
