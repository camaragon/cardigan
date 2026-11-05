import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase } from "../setup/test-db";
import { mcpClient, owner, seedAgent, seedBoard } from "../setup/fixtures";

vi.mock("@clerk/nextjs/server", async () =>
  (await import("../setup/mock-clerk")).clerkServerMock,
);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// The MCP route through the official MCP client, in-process (ADR 0001).
describe.skipIf(!hasTestDatabase)("MCP route", async () => {
  const { db } = await import("@/lib/db");
  const { hashSecret } = await import("@/lib/domain/tokens");
  const { revokeAgentToken } = await import("@/lib/domain/tokens");
  const route = await import("@/app/api/mcp/route");
  const cards = await import("@/lib/domain/cards");

  beforeAll(() => {
    process.env.MCP_ENABLED = "true";
  });
  beforeEach(() => {
    process.env.MCP_ENABLED = "true";
  });
  afterEach(() => {
    delete process.env.SUGGESTION_BOX_ORG_ID;
    delete process.env.SUGGESTION_BOX_BOARD_ID;
  });

  it("is off unless MCP_ENABLED is true", async () => {
    process.env.MCP_ENABLED = "";
    const res = await route.POST(
      new Request("http://localhost/api/mcp", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(404);
  });

  it("C-1: a token is shown once, stored as a hash, scoped to its workspace, and dead after revocation", async () => {
    const { lists } = await seedBoard(owner(), "plain");
    const other = await seedBoard(owner("org_other", "user_other"), "plain");
    const foreign = await db.card.create({
      data: { title: "Foreign", order: 1, listId: other.lists.todo.id },
    });
    const { token, secret } = await seedAgent(owner(), "agent");

    // Stored only as a hash; the secret appears in no stored row.
    const stored = await db.agentToken.findUniqueOrThrow({ where: { id: token.id } });
    expect(stored.secretHash).toBe(hashSecret(secret));
    const dump = JSON.stringify([
      await db.agentToken.findMany(),
      await db.auditLog.findMany(),
    ]);
    expect(dump).not.toContain(secret);

    // Creation is logged.
    expect(
      await db.auditLog.count({
        where: { entityType: "AGENT_TOKEN", action: "CREATE", entityId: token.id },
      }),
    ).toBe(1);

    const agent = await mcpClient(secret);
    const created = await agent.call("create_cards", {
      cards: [{ listId: lists.todo.id, title: "From agent", externalKey: "k1" }],
    });
    expect(created.body.results[0].ok).toBe(true);

    // Other workspaces' ids return not found.
    const cross = await agent.call("get_card", { cardId: foreign.id });
    expect(cross.isError).toBe(true);
    expect(cross.body.error.type).toBe("not_found");
    const crossCreate = await agent.call("create_cards", {
      cards: [{ listId: other.lists.todo.id, title: "Sneaky", externalKey: "k2" }],
    });
    expect(crossCreate.body.results[0].error.type).toBe("not_found");
    expect(await db.card.count({ where: { listId: other.lists.todo.id } })).toBe(1);

    await revokeAgentToken(owner(), token.id);
    expect(
      await db.auditLog.count({ where: { entityId: token.id, action: "REVOKE" } }),
    ).toBe(1);
    const entriesBefore = await db.auditLog.count();
    await expect(agent.call("describe_workspace")).rejects.toThrow();
    expect(await db.auditLog.count()).toBe(entriesBefore);
  });

  it("C-1: a bad token is unauthorized and writes no entry", async () => {
    const before = await db.auditLog.count();
    const res = await route.POST(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: { Authorization: "Bearer cdg_not-a-real-token", "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
    );
    expect(res.status).toBe(401);
    expect(await db.auditLog.count()).toBe(before);
  });

  it("C-2, C-4: task-shaped tools, none that delete or manage tokens or settings", async () => {
    await seedBoard(owner(), "plain");
    const { secret } = await seedAgent(owner(), "agent");
    const agent = await mcpClient(secret);
    const { tools } = await agent.client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "add_comment",
        "create_cards",
        "describe_workspace",
        "get_card",
        "get_changes",
        "list_cards",
        "mark_duplicate",
        "move_card",
        "report_friction",
        "search_cards",
        "update_card",
      ].sort(),
    );
    for (const name of names) {
      expect(name).not.toMatch(/delete|remove|archive|token|setting|role|rule/);
    }
  });

  it("C-5: agent mutations and failed calls are attributed to the token, never the secret", async () => {
    const { lists } = await seedBoard(owner(), "product");
    const { token, secret } = await seedAgent(owner(), "pm");
    const agent = await mcpClient(secret);

    await agent.call("create_cards", {
      cards: [{ listId: lists.proposed.id, title: "Idea", externalKey: "idea-1" }],
    });
    const denied = await agent.call("create_cards", {
      cards: [{ listId: lists.queued.id, title: "Jump the queue", externalKey: "q-1" }],
    });
    expect(denied.body.results[0].error.type).toBe("denied");
    const bad = await agent.call("get_card", { cardId: "missing" });
    expect(bad.isError).toBe(true);
    // Refused by input validation before the handler runs.
    await agent.call("add_comment", { cardId: "x" });

    const ok = await db.auditLog.findFirstOrThrow({
      where: { action: "CREATE", entityType: "CARD", outcome: "OK" },
    });
    expect(ok).toMatchObject({
      actorKind: "AGENT",
      surface: "MCP",
      tokenId: token.id,
      agentRole: "pm",
      userName: "pm agent",
    });

    const failed = await db.auditLog.findMany({
      where: { outcome: "FAILED" },
      orderBy: { createdAt: "asc" },
    });
    expect(failed.map((f) => [f.tool, f.errorType])).toEqual([
      ["get_card", "not_found"],
      ["add_comment", "invalid"],
    ]);
    expect(failed.every((f) => f.tokenId === token.id && f.eventId === null)).toBe(true);
    expect(JSON.stringify(await db.auditLog.findMany())).not.toContain(secret);
  });

  it("S-2: a rule denial names the rule, who may act and an alternative", async () => {
    const { lists } = await seedBoard(owner(), "product");
    const { secret } = await seedAgent(owner(), "pm");
    const agent = await mcpClient(secret);
    const { body } = await agent.call("create_cards", {
      cards: [{ listId: lists.proposed.id, title: "Idea", externalKey: "i" }],
    });
    const card = body.results[0].card;
    const moved = await agent.call("move_card", {
      cardId: card.id,
      toListId: lists.queued.id,
      version: card.version,
    });
    expect(moved.isError).toBe(true);
    expect(moved.body.error).toMatchObject({ type: "denied", rule: "role.capability" });
    expect(moved.body.error.alternative).toMatch(/comment/i);
  });

  it("S-1, C-8: describe returns the caller's role, boards with notices, and lists with rules", async () => {
    await seedBoard(owner(), "product");
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
    expect((await agent.call("report_friction", { ...report, reportKey: "r2" })).body).toEqual({ status: "repeat" });
    expect(await counts()).toEqual([1, 2]);

    const comments = await db.comment.findMany({ where: { orgId: "org_cardigan" } });
    expect(comments.every((c) => !c.body.includes("cdg_abcdef"))).toBe(true);
    expect(comments[0].body).toContain("[redacted]");

    // It cannot read there: the suggestion card is not found from the token.
    const card = await db.card.findFirstOrThrow({ where: { listId: box.id } });
    expect((await agent.call("get_card", { cardId: card.id })).body.error.type).toBe("not_found");

    // Size and field limits.
    expect((await agent.call("report_friction", { ...report, reportKey: "big", description: "x".repeat(5000) })).isError).toBe(true);
    expect((await agent.call("report_friction", { ...report, reportKey: "bad", component: "secrets" })).isError).toBe(true);

    // Rate limit: 10 new reports per token per hour.
    for (let i = 3; i <= 10; i++) {
      expect((await agent.call("report_friction", { ...report, reportKey: `r${i}` })).isError).toBe(false);
    }
    expect((await agent.call("report_friction", { ...report, reportKey: "r11" })).body.error.type).toBe("rate_limited");

    // A workspace without a product board may not file.
    await seedBoard(owner("org_plain", "user_plain"), "plain");
    const plainAgent = await mcpClient((await seedAgent(owner("org_plain", "user_plain"), "agent")).secret);
    expect((await plainAgent.call("report_friction", { ...report, reportKey: "p1" })).body.error.type).toBe("denied");
  });

  it("P-5: after the owner queues a proposal, get_changes returns that move attributed to the owner", async () => {
    const { lists } = await seedBoard(owner(), "product");
    const { secret } = await seedAgent(owner(), "pm");
    const agent = await mcpClient(secret);
    const created = await agent.call("create_cards", {
      cards: [{ listId: lists.proposed.id, title: "Proposal", externalKey: "p" }],
    });
    const cardId = created.body.results[0].card.id;
    const start = (await agent.call("get_changes")).body.nextCursor;

    await cards.moveCard(owner(), { cardId, toListId: lists.queued.id, position: 0 });

    const { body } = await agent.call("get_changes", { cursor: start });
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      action: "MOVE",
      entityId: cardId,
      fromListId: lists.proposed.id,
      toListId: lists.queued.id,
      actor: { kind: "OWNER", surface: "UI" },
    });
  });
});
