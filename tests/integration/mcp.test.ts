import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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

  beforeAll(() => {
    process.env.MCP_ENABLED = "true";
  });
  beforeEach(() => {
    process.env.MCP_ENABLED = "true";
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
        "search_cards",
        "update_card",
      ].sort(),
    );
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
});
