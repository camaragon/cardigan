import { beforeEach, describe, expect, it, vi } from "vitest";
import { clerkState, resetClerk } from "../setup/mock-clerk";
import { hasTestDatabase } from "../setup/test-db";
import { mcpClient, member, owner, roleActor, seedAgent, seedTemplateBoard } from "../setup/fixtures";

vi.mock("@clerk/nextjs/server", async () =>
  (await import("../setup/mock-clerk")).clerkServerMock,
);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// The product template's list rules (ADR 0004), enforced for people in the
// UI and for agents through the same domain functions and MCP.
describe.skipIf(!hasTestDatabase)("product board", async () => {
  const { db } = await import("@/lib/db");
  const cards = await import("@/lib/domain/cards");
  const { addComment, markDuplicate } = await import("@/lib/domain/comments");
  const { getChanges } = await import("@/lib/domain/changes");
  const { updateCard: updateCardAction } = await import("@/actions/update-card");
  const { createCard: createCardAction } = await import("@/actions/create-card");
  const { moveCard: moveCardAction } = await import("@/actions/move-card");

  beforeEach(() => {
    resetClerk();
    process.env.MCP_ENABLED = "true";
  });

  const asMember = () => {
    clerkState.userId = "user_member";
    clerkState.orgRole = "org:member";
  };

  it("P-2: only the owner creates in, moves into, reorders or edits Queued and In flight; denied attempts change nothing", async () => {
    const { board, lists } = await seedTemplateBoard(owner(), "product");
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
    expect((await updateCardAction({ id: q1.id, boardId: board.id, title: "Member edit" })).error).toMatch(/Not allowed/);
    expect((await createCardAction({ boardId: board.id, listId: lists.queued.id, title: "Member queue" })).error).toMatch(/Not allowed/);
  });

  it("P-3: PM proposes, edits and marks duplicates in Proposed and comments anywhere; only the supervisor moves work through", async () => {
    const { lists } = await seedTemplateBoard(owner(), "product");
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
    await addComment(pm, { cardId: queued.id, body: "Note on queued work", externalKey: "c1" });

    await expect(cards.moveCard(pm, { cardId: queued.id, toListId: lists.in_flight.id })).rejects.toMatchObject({ type: "denied" });
    await cards.moveCard(supervisor, { cardId: queued.id, toListId: lists.in_flight.id });
    await cards.moveCard(supervisor, { cardId: queued.id, toListId: lists.done.id });
    await expect(cards.moveCard(supervisor, { cardId: a.id, toListId: lists.queued.id })).rejects.toMatchObject({ type: "denied" });

    // Supervisor creates and edits Waiting on owner cards keyed by task and question.
    const { card: q } = await cards.createCard(supervisor, { listId: lists.waiting_on_owner.id, title: "Question", externalKey: "task-42:q1" });
    await cards.updateCard(supervisor, { cardId: q.id, description: "More context" });
    await expect(cards.updateCard(pm, { cardId: q.id, title: "x" })).rejects.toMatchObject({ type: "denied" });
    await expect(cards.createCard(supervisor, { listId: lists.proposed.id, title: "S", externalKey: "s" })).rejects.toMatchObject({ type: "denied" });

    // C-3: two roles' keys never collide.
    const other = await cards.createCard(supervisor, { listId: lists.waiting_on_owner.id, title: "Q", externalKey: "a" });
    expect(other.created).toBe(true);
  });

  it("C-8, P-5: a member's drag into Queued snaps back; the owner's reaches the changes query", async () => {
    const { board, lists } = await seedTemplateBoard(owner(), "product");
    const pm = await roleActor("pm");
    const { card } = await cards.createCard(pm, { listId: lists.proposed.id, title: "Proposal", externalKey: "p" });
    const start = (await getChanges(pm)).nextCursor;

    asMember();
    const refused = await moveCardAction({ id: card.id, boardId: board.id, toListId: lists.queued.id, position: 0 });
    expect(refused.error).toMatch(/Not allowed/);
    expect((await db.card.findUniqueOrThrow({ where: { id: card.id } })).listId).toBe(lists.proposed.id);

    resetClerk();
    expect((await moveCardAction({ id: card.id, boardId: board.id, toListId: lists.queued.id, position: 0 })).error).toBeUndefined();

    const { events } = await getChanges(pm, { cursor: start });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "MOVE",
      entityId: card.id,
      fromListId: lists.proposed.id,
      toListId: lists.queued.id,
      actor: { kind: "OWNER", surface: "UI" },
    });
  });

  it("S-2: a rule denial through MCP names the rule, who may act and an alternative", async () => {
    const { lists } = await seedTemplateBoard(owner(), "product");
    const { secret } = await seedAgent(owner(), "pm");
    const agent = await mcpClient(secret);
    const { body } = await agent.call("create_cards", {
      cards: [{ listId: lists.proposed.id, title: "Idea", externalKey: "i" }],
    });
    const card = body.results[0].card;
    const moved = await agent.call("move_card", { cardId: card.id, toListId: lists.queued.id, version: card.version });
    expect(moved.isError).toBe(true);
    expect(moved.body.error).toMatchObject({ type: "denied", rule: "role.capability" });
    expect(moved.body.error.alternative).toMatch(/comment/i);

    const queued = await agent.call("create_cards", {
      cards: [{ listId: lists.queued.id, title: "Jump the queue", externalKey: "q" }],
    });
    expect(queued.body.results[0].error.type).toBe("denied");
  });

  it("S-1, C-8: describe returns the caller's role, board notices, and lists with rules", async () => {
    await seedTemplateBoard(owner(), "product");
    const { secret } = await seedAgent(owner(), "supervisor");
    const agent = await mcpClient(secret);
    const { body } = await agent.call("describe_workspace");
    expect(body.you).toMatchObject({ role: "Supervisor", capabilities: ["create", "update", "move", "comment"] });
    const board = body.boards[0];
    expect(board.notice).toBeTruthy();
    expect(board).not.toHaveProperty("imageFullUrl");
    const queued = board.lists.find((l: { key: string }) => l.key === "queued");
    expect(queued.rules.create).toEqual(["the owner"]);
    expect(body.labels.map((l: { name: string }) => l.name)).toContain("Declined");
  });
});
