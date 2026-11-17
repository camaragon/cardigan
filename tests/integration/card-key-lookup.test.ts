import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { updateBoard } from "@/lib/domain/boards";
import { createCard } from "@/lib/domain/cards";
import { mcpClient, owner, seedAgent, seedBoard } from "../setup/fixtures";
import { hasTestDatabase } from "../setup/test-db";
import { clerkState, resetClerk } from "../setup/mock-clerk";

vi.mock("@clerk/nextjs/server", async () => (await import("../setup/mock-clerk")).clerkServerMock);

describe.skipIf(!hasTestDatabase)("card key lookup", () => {
  beforeEach(() => { resetClerk(); vi.stubEnv("MCP_ENABLED", "true"); });
  afterEach(() => vi.unstubAllEnvs());

  it("resolves current and old keys for every MCP card reference only in the caller's workspace", async () => {
    const { board, lists } = await seedBoard(owner());
    await updateBoard(owner(), { id: board.id, keyPrefix: "DEMO" });
    const { card } = await createCard(owner(), { listId: lists.todo.id, title: "First" });
    const { card: blocker } = await createCard(owner(), { listId: lists.todo.id, title: "Second" });
    await updateBoard(owner(), { id: board.id, keyPrefix: "ABC" });
    const { secret } = await seedAgent(owner(), "agent");
    const { secret: foreignSecret } = await seedAgent(owner("foreign"), "agent");
    const local = await mcpClient(secret);
    const foreign = await mcpClient(foreignSecret);
    try {
      expect((await local.call("describe_workspace")).body.boards[0].keyPrefix).toBe("ABC");
      for (const cardId of [card.id, "DEMO-1", "abc-1"]) {
        expect((await local.call("get_card", { cardId })).body).toMatchObject({ id: card.id, key: "ABC-1" });
        expect((await foreign.call("get_card", { cardId })).body.error.type).toBe("not_found");
      }
      expect((await local.call("search_cards", { query: "demo-1" })).body.cards[0].id).toBe(card.id);
      expect((await foreign.call("search_cards", { query: "DEMO-1" })).body.cards).toEqual([]);
      expect((await local.call("update_card", { cardId: "DEMO-1", version: 1, blockedByIds: ["missing"] })).body.error)
        .toMatchObject({ type: "not_found", message: "Blocked-by card in this workspace not found" });
      expect((await local.call("update_card", { cardId: "DEMO-1", version: 1, blockedByIds: ["DEMO-2"] })).body)
        .toMatchObject({ id: card.id, key: "ABC-1", blockedByIds: [blocker.id] });
      expect((await local.call("move_card", { cardId: "DEMO-1", version: 2, toListId: lists.done.id })).body)
        .toMatchObject({ id: card.id, key: "ABC-1", listId: lists.done.id });
      const first = await local.call("add_comment", { cardId: "DEMO-1", body: "Note", externalKey: "note" });
      const replay = await local.call("add_comment", { cardId: "ABC-1", body: "Note", externalKey: "note" });
      expect(replay.body).toEqual({ commentId: first.body.commentId, created: false });
      expect((await local.call("mark_duplicate", { cardId: "ABC-1", canonicalCardId: "DEMO-1", externalKey: "self" })).body.error.type).toBe("invalid");
      const duplicate = await local.call("mark_duplicate", { cardId: "DEMO-1", canonicalCardId: "DEMO-2", externalKey: "duplicate" });
      expect(await db.comment.findUnique({ where: { id: duplicate.body.commentId } })).toMatchObject({ duplicateOfCardId: blocker.id });
      expect((await foreign.call("update_card", { cardId: "DEMO-1", version: 3, title: "No" })).body.error.type).toBe("not_found");
      const other = await seedBoard(owner("foreign"));
      await updateBoard(owner("foreign"), { id: other.board.id, keyPrefix: "DEMO" });
      const otherCard = await createCard(owner("foreign"), { listId: other.lists.todo.id, title: "Other" });
      expect((await foreign.call("get_card", { cardId: "DEMO-1" })).body.id).toBe(otherCard.card.id);
    } finally {
      await local.close();
      await foreign.close();
    }
  });

  it("returns the current key through API reads, including aliases, without crossing workspaces", async () => {
    const { GET } = await import("@/app/api/cards/[cardId]/route");
    const { GET: comments } = await import("@/app/api/cards/[cardId]/comments/route");
    const { GET: logs } = await import("@/app/api/cards/[cardId]/logs/route");
    const { GET: options } = await import("@/app/api/cards/blocker-options/route");
    const { board, lists } = await seedBoard(owner());
    await updateBoard(owner(), { id: board.id, keyPrefix: "DEMO" });
    const { card } = await createCard(owner(), { listId: lists.todo.id, title: "Task" });
    await updateBoard(owner(), { id: board.id, keyPrefix: "ABC" });
    const req = new Request("http://localhost/api/cards/DEMO-1");
    const params = { params: Promise.resolve({ cardId: "demo-1" }) };
    expect(await (await GET(req, params)).json()).toMatchObject({ id: card.id, key: "ABC-1" });
    expect((await comments(req, params)).status).toBe(200);
    expect((await (await logs(req, params)).json()).length).toBe(1);
    expect((await (await options(new Request("http://localhost/api/cards/blocker-options?query=demo-1"))).json()).cards)
      .toEqual([{ id: card.id, title: "Task", key: "ABC-1" }]);
    clerkState.orgId = "foreign";
    for (const read of [GET, comments, logs]) expect((await read(req, params)).status).toBe(404);
  });
});
