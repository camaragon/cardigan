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
  const { revokeAgentToken } = await import("@/lib/domain/tokens");
  const route = await import("@/app/api/mcp/route");
  const { TOOL_NAMES } = await import("@/lib/mcp/server");

  beforeAll(() => {
    process.env.MCP_ENABLED = "true";
  });
  beforeEach(() => {
    process.env.MCP_ENABLED = "true";
  });
  afterEach(() => {
    delete process.env.SUGGESTION_BOX_ORG_ID;
    delete process.env.SUGGESTION_BOX_LIST_ID;
  });

  it("is off unless MCP_ENABLED is true", async () => {
    process.env.MCP_ENABLED = "";
    const res = await route.POST(
      new Request("http://localhost/api/mcp", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(404);
  });

  it("C-1: a token acts only in its workspace and is dead after revocation", async () => {
    const { lists } = await seedBoard(owner());
    const other = await seedBoard(owner("org_other", "user_other"));
    const foreign = await db.card.create({
      data: { title: "Foreign", order: 1, listId: other.lists.todo.id },
    });
    const { token, secret } = await seedAgent(owner(), "agent");

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
    expect([...TOOL_NAMES].sort()).toEqual(names);
    for (const name of names) {
      expect(name).not.toMatch(/delete|remove|archive|token|setting|role|rule/);
    }
  });

  it("C-5: agent mutations and failed calls are attributed to the token, never the secret", async () => {
    const { lists } = await seedBoard(owner());
    const { token, secret } = await seedAgent(owner(), "agent", "Helper");
    const agent = await mcpClient(secret);

    await agent.call("create_cards", {
      cards: [{ listId: lists.todo.id, title: "Idea", externalKey: "idea-1" }],
    });
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
      agentRole: "agent",
      userName: "Helper",
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

  it("A-3: agents follow the people's text rules: one character is enough, empty is refused", async () => {
    const { lists } = await seedBoard(owner());
    const { secret } = await seedAgent(owner(), "agent");
    const agent = await mcpClient(secret);

    const short = await agent.call("create_cards", {
      cards: [{ listId: lists.todo.id, title: "a", description: "b", externalKey: "s" }],
    });
    expect(short.body.results[0]).toMatchObject({ ok: true, card: { title: "a" } });
    const empty = await agent.call("create_cards", {
      cards: [{ listId: lists.todo.id, title: "", externalKey: "e" }],
    });
    expect(empty.isError).toBe(true);
  });

  it("S-1: describe returns the caller's role, boards with their lists, and labels", async () => {
    const { board } = await seedBoard(owner());
    await db.label.create({ data: { name: "Bug", color: "#f00", orgId: "org_test" } });
    const { secret } = await seedAgent(owner(), "agent");
    const agent = await mcpClient(secret);
    const { body } = await agent.call("describe_workspace");
    expect(body.you).toMatchObject({ role: "Agent", kind: "AGENT" });
    expect(body.you.capabilities).toContain("move");
    expect(body.boards).toEqual([
      {
        id: board.id,
        title: board.title,
        lists: [
          expect.objectContaining({ title: "To do" }),
          expect.objectContaining({ title: "Doing" }),
          expect.objectContaining({ title: "Done" }),
        ],
      },
    ]);
    expect(body.labels.map((l: { name: string }) => l.name)).toEqual(["Bug"]);
  });

  it("C-9: friction reports are write-only, retry-safe, deduplicated by fingerprint, redacted and limited", async () => {
    // The destination is an ordinary list in a separate workspace.
    const home = await seedBoard(owner("org_feedback", "user_home"), "Feedback");
    process.env.SUGGESTION_BOX_ORG_ID = "org_feedback";
    process.env.SUGGESTION_BOX_LIST_ID = home.lists.todo.id;

    const { secret } = await seedAgent(owner(), "agent");
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
    const box = home.lists.todo;
    const counts = async () => [
      await db.card.count({ where: { listId: box.id } }),
      await db.comment.count({ where: { orgId: "org_feedback" } }),
    ];
    expect(await counts()).toEqual([1, 1]);

    // Resubmitting a report key changes nothing.
    expect((await agent.call("report_friction", report)).body).toEqual({ status: "new" });
    expect(await counts()).toEqual([1, 1]);

    // A new key with the same fingerprint is a repeat: one more comment.
    expect((await agent.call("report_friction", { ...report, reportKey: "r2" })).body).toEqual({ status: "repeat" });
    expect(await counts()).toEqual([1, 2]);

    const comments = await db.comment.findMany({ where: { orgId: "org_feedback" } });
    expect(comments.every((c) => !c.body.includes("cdg_abcdef"))).toBe(true);
    expect(comments[0].body).toContain("[redacted]");

    // It cannot read there: the suggestion card is not found from the token.
    const card = await db.card.findFirstOrThrow({ where: { listId: box.id } });
    expect((await agent.call("get_card", { cardId: card.id })).body.error.type).toBe("not_found");

    // Size and field limits.
    expect((await agent.call("report_friction", { ...report, reportKey: "big", description: "x".repeat(5000) })).isError).toBe(true);
    expect((await agent.call("report_friction", { ...report, reportKey: "bad", component: "secrets" })).isError).toBe(true);

    // Rate limit: tokens in the same workspace share 10 new reports per hour.
    for (let i = 3; i <= 9; i++) {
      expect((await agent.call("report_friction", { ...report, reportKey: `r${i}` })).isError).toBe(false);
    }
    const secondAgent = await mcpClient((await seedAgent(owner(), "agent", "Second agent")).secret);
    const concurrent = await Promise.all([
      agent.call("report_friction", { ...report, reportKey: "r10" }),
      secondAgent.call("report_friction", { ...report, reportKey: "r11" }),
    ]);
    expect(concurrent.filter((result) => !result.isError)).toHaveLength(1);
    expect(concurrent.find((result) => result.isError)?.body.error.type).toBe("rate_limited");
    expect((await secondAgent.call("report_friction", { ...report, reportKey: "r12" })).body.error.type).toBe("rate_limited");
    // Replaying a report still succeeds after the workspace has used its quota.
    expect((await secondAgent.call("report_friction", report)).body).toEqual({ status: "new" });
    await secondAgent.close();

    // Any workspace may file, including a workspace with no boards.
    const plainAgent = await mcpClient((await seedAgent(owner("org_plain", "user_plain"), "agent")).secret);
    expect((await plainAgent.call("report_friction", { ...report, reportKey: "p1" })).body).toEqual({ status: "repeat" });

    // A misconfigured target never writes to an unrelated workspace.
    process.env.SUGGESTION_BOX_ORG_ID = "org_wrong";
    expect((await plainAgent.call("report_friction", { ...report, reportKey: "p2" })).body.error.type).toBe("unavailable");
    expect(await counts()).toEqual([1, 11]);
    await agent.close();
    await plainAgent.close();
  });

  it("recreates a deleted suggestion card and keeps report retries stable", async () => {
    const home = await seedBoard(owner("org_feedback", "user_home"), "Feedback");
    process.env.SUGGESTION_BOX_ORG_ID = "org_feedback";
    process.env.SUGGESTION_BOX_LIST_ID = home.lists.todo.id;
    const client = await mcpClient((await seedAgent(owner(), "agent")).secret);
    const report = {
      reportKey: "original", component: "cards", category: "confusing_tool",
      tool: "move_card", impact: "medium", description: "Position was unclear.",
    };
    try {
      expect((await client.call("report_friction", report)).body).toEqual({ status: "new" });
      const original = await db.card.findFirstOrThrow({ where: { listId: home.lists.todo.id } });
      await db.card.delete({ where: { id: original.id } });
      // The old receipt replays without recreating a card or comment.
      expect((await client.call("report_friction", report)).body).toEqual({ status: "new" });
      expect(await db.card.count()).toBe(0);
      const replacementReport = { ...report, reportKey: "replacement" };
      expect((await client.call("report_friction", replacementReport)).body).toEqual({ status: "new" });
      const replacement = await db.card.findFirstOrThrow({ where: { listId: home.lists.todo.id } });
      expect(replacement.id).not.toBe(original.id);
      expect(await db.externalKey.findFirst({ where: { scope: "friction:fingerprint" } })).toMatchObject({ entityId: replacement.id });
      expect((await client.call("report_friction", replacementReport)).body).toEqual({ status: "new" });
      expect((await client.call("report_friction", { ...report, reportKey: "repeat" })).body).toEqual({ status: "repeat" });
      expect(await db.card.count()).toBe(1);
      expect(await db.comment.count({ where: { cardId: replacement.id } })).toBe(2);
    } finally { await client.close(); }
  });
});
