import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clerkState, resetClerk } from "../setup/mock-clerk";
import { hasTestDatabase } from "../setup/test-db";
import { member, mcpClient, owner, seedAgent, seedBoard } from "../setup/fixtures";

vi.mock("@clerk/nextjs/server", async () =>
  (await import("../setup/mock-clerk")).clerkServerMock,
);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// One test per PRD acceptance criterion in this slice. People act through the
// server actions (UI surface); agents through domain functions or MCP.
describe.skipIf(!hasTestDatabase)("agent access", async () => {
  const { db } = await import("@/lib/db");
  const cards = await import("@/lib/domain/cards");
  const { getChanges } = await import("@/lib/domain/changes");
  const { createBoard } = await import("@/lib/domain/boards");
  const { createAgentToken } = await import("@/lib/domain/tokens");
  const { moveCard: moveCardAction } = await import("@/actions/move-card");
  const { updateCard: updateCardAction } = await import("@/actions/update-card");
  const { createCard: createCardAction } = await import("@/actions/create-card");

  beforeEach(() => {
    resetClerk();
    process.env.MCP_ENABLED = "true";
  });
  afterEach(() => {
    delete process.env.SUGGESTION_BOX_ORG_ID;
    delete process.env.SUGGESTION_BOX_BOARD_ID;
  });

  const asMember = () => {
    clerkState.userId = "user_member";
    clerkState.orgRole = "org:member";
  };

  it("C-1, C-4: only the owner manages tokens; members and agents cannot", async () => {
    await seedBoard(owner(), "plain");
    await expect(
      createAgentToken(member(), { agentName: "x", roleKey: "agent" }),
    ).rejects.toMatchObject({ type: "denied" });
    const { actor } = await seedAgent(owner(), "agent");
    await expect(
      createAgentToken(actor, { agentName: "x", roleKey: "agent" }),
    ).rejects.toMatchObject({ type: "denied" });
    expect(await db.agentToken.count()).toBe(1);
  });

  it("C-3: same key and payload return one card and one create entry; a different payload conflicts; roles' keys never collide", async () => {
    const { lists } = await seedBoard(owner(), "product");
    const pm = (await seedAgent(owner(), "pm")).actor;
    const supervisor = (await seedAgent(owner(), "supervisor")).actor;
    const input = { listId: lists.proposed.id, title: "Idea", externalKey: "task-1" };

    const first = await cards.createCard(pm, input);
    const again = await cards.createCard(pm, input);
    expect(again.card.id).toBe(first.card.id);
    expect(again.created).toBe(false);
    expect(await db.card.count()).toBe(1);
    expect(await db.auditLog.count({ where: { action: "CREATE", entityType: "CARD" } })).toBe(1);

    await expect(
      cards.createCard(pm, { ...input, title: "Different" }),
    ).rejects.toMatchObject({ type: "conflict" });

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
    const agent = (await seedAgent(owner(), "agent")).actor;
    const { card } = await cards.createCard(agent, {
      listId: lists.todo.id,
      title: "Card",
      externalKey: "c",
    });
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

  it("C-6: a UI drag is one single-card move with source, target and position", async () => {
    const { board, lists } = await seedBoard(owner(), "plain");
    const a = await createCardAction({ boardId: board.id, listId: lists.todo.id, title: "Card A" });
    const b = await createCardAction({ boardId: board.id, listId: lists.todo.id, title: "Card B" });

    const reorder = await moveCardAction({ id: b.data!.id, boardId: board.id, toListId: lists.todo.id, position: 0 });
    expect(reorder.error).toBeUndefined();
    const move = await moveCardAction({ id: a.data!.id, boardId: board.id, toListId: lists.doing.id, position: 0 });
    expect(move.error).toBeUndefined();

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

  it("C-7: paging from any cursor while events are written returns each event id once, in order", async () => {
    const { lists } = await seedBoard(owner(), "plain");
    const agent = (await seedAgent(owner(), "agent")).actor;
    const create = (i: number) =>
      cards.createCard(agent, { listId: lists.todo.id, title: `Card ${i}`, externalKey: `k${i}` });

    for (let i = 0; i < 3; i++) await create(i);
    const seen: number[] = [];
    let cursor: string | undefined;
    let i = 3;
    for (;;) {
      // Concurrent writers while paging.
      const writes = i < 12 ? [create(i++), create(i++), create(i++)] : [];
      const page = await getChanges(agent, { cursor, limit: 2 });
      await Promise.all(writes);
      seen.push(...page.events.map((e) => e.eventId));
      cursor = page.nextCursor;
      if (!page.hasMore && writes.length === 0) {
        const tail = await getChanges(agent, { cursor, limit: 50 });
        seen.push(...tail.events.map((e) => e.eventId));
        break;
      }
    }
    const all = await db.auditLog.findMany({
      where: { orgId: "org_test", eventId: { not: null } },
      orderBy: { eventId: "asc" },
    });
    expect(seen).toEqual(all.map((e) => e.eventId));
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("C-8: rules come from the template, are described, and are enforced in the UI and MCP; plain boards are open", async () => {
    const product = await seedBoard(owner(), "product");
    const plain = await seedBoard(owner(), "plain");
    const { secret } = await seedAgent(owner(), "agent");
    const agent = await mcpClient(secret);

    const { body } = await agent.call("describe_workspace");
    const productBoard = body.boards.find((b: { template: string }) => b.template === "product");
    expect(productBoard.notice).toBeTruthy();
    const queued = productBoard.lists.find((l: { key: string }) => l.key === "queued");
    expect(queued.rules.create).toEqual(["the owner"]);
    expect(queued.notice).toBeTruthy();

    // UI: a member cannot move a proposal into Queued; the owner can.
    const proposal = await createCardAction({ boardId: product.board.id, listId: product.lists.proposed.id, title: "Proposal" });
    asMember();
    const refused = await moveCardAction({ id: proposal.data!.id, boardId: product.board.id, toListId: product.lists.queued.id, position: 0 });
    expect(refused.error).toMatch(/Not allowed/);
    resetClerk();
    const allowed = await moveCardAction({ id: proposal.data!.id, boardId: product.board.id, toListId: product.lists.queued.id, position: 0 });
    expect(allowed.error).toBeUndefined();

    // Plain board: any member or agent creates in and moves to any list.
    asMember();
    const memberCard = await createCardAction({ boardId: plain.board.id, listId: plain.lists.done.id, title: "Member card" });
    expect(memberCard.error).toBeUndefined();
    const created = await agent.call("create_cards", {
      cards: [{ listId: plain.lists.doing.id, title: "Agent card", externalKey: "p1" }],
    });
    const agentCard = created.body.results[0].card;
    for (const target of [plain.lists.done, plain.lists.todo]) {
      const current = await db.card.findUniqueOrThrow({ where: { id: agentCard.id } });
      const moved = await agent.call("move_card", { cardId: agentCard.id, toListId: target.id, version: current.version });
      expect(moved.isError).toBe(false);
    }
  });

  it("C-9: friction reports are write-only, retry-safe, deduplicated by fingerprint, redacted and limited", async () => {
    // Cardigan's own workspace and board hold the suggestion box.
    const home = await seedBoard(owner("org_cardigan", "user_home"), "product", "Cardigan");
    process.env.SUGGESTION_BOX_ORG_ID = "org_cardigan";
    process.env.SUGGESTION_BOX_BOARD_ID = home.board.id;

    await seedBoard(owner(), "product");
    const { secret } = await seedAgent(owner(), "pm");
    const agent = await mcpClient(secret);
    const report = {
      reportKey: "r1",
      component: "cards",
      category: "confusing_tool",
      tool: "move_card",
      impact: "medium",
      description: "Position was unclear. My key is cdg_abcdefghijklmnopqrstuvwxyz0123456789",
    };

    const first = await agent.call("report_friction", report);
    expect(first.body).toEqual({ status: "new" });
    const box = await db.list.findFirstOrThrow({ where: { boardId: home.board.id, templateKey: "suggestion_box" } });
    const counts = async () => [
      await db.card.count({ where: { listId: box.id } }),
      await db.comment.count({ where: { orgId: "org_cardigan" } }),
    ];
    expect(await counts()).toEqual([1, 1]);

    // Resubmitting a report key changes nothing.
    expect((await agent.call("report_friction", report)).body).toEqual({ status: "new" });
    expect(await counts()).toEqual([1, 1]);

    // A new key with the same fingerprint is a repeat: one more comment.
    const repeat = await agent.call("report_friction", { ...report, reportKey: "r2" });
    expect(repeat.body).toEqual({ status: "repeat" });
    expect(await counts()).toEqual([1, 2]);

    const comments = await db.comment.findMany({ where: { orgId: "org_cardigan" } });
    expect(comments.every((c) => !c.body.includes("cdg_abcdef"))).toBe(true);
    expect(comments[0].body).toContain("[redacted]");

    // It cannot read there: the suggestion card is not found from the token.
    const card = await db.card.findFirstOrThrow({ where: { listId: box.id } });
    expect((await agent.call("get_card", { cardId: card.id })).body.error.type).toBe("not_found");

    // Size and field limits.
    const big = await agent.call("report_friction", { ...report, reportKey: "big", description: "x".repeat(5000) });
    expect(big.isError).toBe(true);
    const badField = await agent.call("report_friction", { ...report, reportKey: "bad", component: "secrets" });
    expect(badField.isError).toBe(true);

    // Rate limit: 10 new reports per token per hour.
    for (let i = 3; i <= 10; i++) {
      expect((await agent.call("report_friction", { ...report, reportKey: `r${i}` })).isError).toBe(false);
    }
    const limited = await agent.call("report_friction", { ...report, reportKey: "r11" });
    expect(limited.body.error.type).toBe("rate_limited");

    // A workspace without a product board may not file.
    await seedBoard(owner("org_plain", "user_plain"), "plain");
    const plainAgent = await mcpClient((await seedAgent(owner("org_plain", "user_plain"), "agent")).secret);
    const refused = await plainAgent.call("report_friction", { ...report, reportKey: "p1" });
    expect(refused.body.error.type).toBe("denied");
  });

  it("P-1: a product board has its five lists, Declined label, roles, rules and notice; one per workspace", async () => {
    const { board, lists } = await seedBoard(owner(), "product");
    const ordered = await db.list.findMany({ where: { boardId: board.id }, orderBy: { order: "asc" } });
    expect(ordered.map((l) => l.title)).toEqual(["Proposed", "Queued", "In flight", "Waiting on owner", "Done"]);
    expect(ordered.every((l) => l.rules !== null)).toBe(true);
    expect(lists.waiting_on_owner.notice).toBeTruthy();
    expect(board.notice).toBeTruthy();
    expect(await db.label.findFirst({ where: { orgId: "org_test", name: "Declined" } })).not.toBeNull();
    const roles = await db.agentRole.findMany({ where: { orgId: "org_test" } });
    expect(roles.map((r) => r.key).sort()).toEqual(["pm", "supervisor"]);

    await expect(seedBoard(owner(), "product", "Second")).rejects.toMatchObject({ type: "conflict" });
    await expect(
      createBoard(member(), {
        title: "Third",
        template: "product",
        image: { imageId: "i", imageThumbUrl: "t", imageFullUrl: "f", imageUserName: "u", imageLinkHTML: "l" },
      }),
    ).rejects.toMatchObject({ type: "conflict" });
  });

  it("P-2: only the owner creates in, moves into, reorders or edits Queued and In flight; denied attempts change nothing", async () => {
    const { board, lists } = await seedBoard(owner(), "product");
    const pm = (await seedAgent(owner(), "pm")).actor;
    const supervisor = (await seedAgent(owner(), "supervisor")).actor;
    const people = [member()];
    const agents = [pm, supervisor];

    const { card: proposal } = await cards.createCard(owner(), { listId: lists.proposed.id, title: "P" });
    const { card: q1 } = await cards.createCard(owner(), { listId: lists.queued.id, title: "Q1" });
    const { card: q2 } = await cards.createCard(owner(), { listId: lists.queued.id, title: "Q2" });
    await cards.moveCard(owner(), { cardId: q2.id, toListId: lists.queued.id, position: 0 });
    const snapshot = async () =>
      JSON.stringify(await db.card.findMany({ orderBy: { id: "asc" } }));
    const before = await snapshot();

    for (const actor of [...people, ...agents]) {
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

    // The owner edits and reorders queued work in the UI.
    const edited = await updateCardAction({ id: q1.id, boardId: board.id, title: "Owner edit" });
    expect(edited.error).toBeUndefined();
    asMember();
    const memberEdit = await updateCardAction({ id: q1.id, boardId: board.id, title: "Member edit" });
    expect(memberEdit.error).toMatch(/Not allowed/);
  });

  it("P-3: PM proposes, edits and marks duplicates in Proposed and comments anywhere; only the supervisor moves work through", async () => {
    const { lists } = await seedBoard(owner(), "product");
    const pm = (await seedAgent(owner(), "pm")).actor;
    const supervisor = (await seedAgent(owner(), "supervisor")).actor;
    const { addComment, markDuplicate } = await import("@/lib/domain/comments");

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

  it("P-5: after the owner queues a proposal, the changes query returns that move attributed to the owner", async () => {
    const { board, lists } = await seedBoard(owner(), "product");
    const { secret, actor: pm } = await seedAgent(owner(), "pm");
    const { card } = await cards.createCard(pm, { listId: lists.proposed.id, title: "Proposal", externalKey: "p" });
    const start = (await getChanges(pm)).nextCursor;

    const queued = await moveCardAction({ id: card.id, boardId: board.id, toListId: lists.queued.id, position: 0 });
    expect(queued.error).toBeUndefined();

    const agent = await mcpClient(secret);
    const { body } = await agent.call("get_changes", { cursor: start });
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      action: "MOVE",
      entityId: card.id,
      fromListId: lists.proposed.id,
      toListId: lists.queued.id,
      actor: { kind: "OWNER", surface: "UI" },
    });
  });
});
