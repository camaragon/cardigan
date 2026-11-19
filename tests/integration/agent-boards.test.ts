import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { hasTestDatabase } from "../setup/test-db";
import { mcpClient, owner, seedAgent, seedBoard } from "../setup/fixtures";
import { CAPABILITIES } from "@/lib/domain/actor";

describe.skipIf(!hasTestDatabase)("agent boards", async () => {
  const { db } = await import("@/lib/db");
  const { createBoard, updateBoard } = await import("@/lib/domain/boards");
  const { deleteBoard } = await import("@/lib/domain/deletes");
  const migration = readFileSync(new URL("../../prisma/migrations/20261119000000_agent_boards/migration.sql", import.meta.url), "utf8");
  beforeEach(() => { process.env.MCP_ENABLED = "true"; });

  it("upgrades an existing general role; creates usable lists, retries safely and audits a confirmed cascade delete", async () => {
    await db.agentRole.create({ data: { orgId: "org_test", key: "agent", name: "Agent", capabilities: CAPABILITIES.filter(c => c !== "manage_boards") } });
    const { secret, token } = await seedAgent(owner(), "agent", "Board helper");
    await db.$executeRawUnsafe(migration);
    const client = await mcpClient(secret);
    try {
      expect((await client.call("describe_workspace")).body.you.capabilities).toContain("manage_boards");
      const input = { title: "Demo", template: "product_management", listTitles: ["Queue", "Finished"], keyPrefix: "DEMO", externalKey: "demo-board" };
      const [first, retry] = await Promise.all([client.call("create_board", input), client.call("create_board", input)]);
      expect(first.isError).toBe(false);
      const board = first.body;
      expect(retry.body).toEqual(board);
      expect(board.lists).toEqual(input.listTitles.map(title => ({ id: expect.any(String), title })));
      expect((await client.call("create_board", input)).body).toEqual(board);
      expect((await client.call("create_board", { ...input, title: "Different" })).body.error.type).toBe("conflict");
      expect(await db.board.count()).toBe(1);
      expect(await db.board.findUnique({ where: { id: board.id } })).toMatchObject({ imageFullUrl: "/backgrounds/ocean.svg" });
      expect(await db.label.count()).toBe(3);
      const cards = await client.call("create_cards", { cards: [{ listId: board.lists[0].id, title: "Work", externalKey: "work-card" }] });
      expect(cards.body.results[0]).toMatchObject({ ok: true, card: { key: "DEMO-1" } });
      await client.call("add_comment", { cardId: cards.body.results[0].card.id, body: "Note", externalKey: "note" });
      await updateBoard(owner(), { id: board.id, title: "Current title" });
      for (const confirmation of ["Demo", "current title", "Current title "]) {
        const refused = await client.call("delete_board", { boardId: board.id, confirmation });
        expect(refused.body.error).toMatchObject({ type: "denied", rule: "board.delete_confirmation" });
        expect(await db.board.count()).toBe(1);
      }
      expect((await client.call("delete_board", { boardId: board.id, confirmation: "Current title" })).body).toEqual({ id: board.id, deleted: true });
      expect(await db.board.count()).toBe(0);
      expect(await db.list.count()).toBe(0);
      expect(await db.card.count()).toBe(0);
      expect(await db.comment.count()).toBe(0);
      expect(await db.boardKeyPrefix.count()).toBe(0);
      const logs = await db.auditLog.findMany({ where: { entityId: board.id, action: { in: ["CREATE", "DELETE"] } }, orderBy: { eventId: "asc" } });
      expect(logs.map(log => log.action)).toEqual(["CREATE", "DELETE"]);
      for (const log of logs) expect(log).toMatchObject({ actorKind: "AGENT", userId: token.id, userName: "Board helper", tokenId: token.id, surface: "MCP" });
      expect((await client.call("create_board", input)).body.error.type).toBe("not_found");
      expect(await db.board.count()).toBe(0);
    } finally { await client.close(); }
  });

  it("preserves narrower roles during migration and denies both domain writes", async () => {
    const capabilities = CAPABILITIES.filter(c => c !== "manage_boards");
    await db.agentRole.create({ data: { orgId: "org_test", key: "cards_only", name: "Agent", capabilities } });
    await db.$executeRawUnsafe(migration);
    const { actor } = await seedAgent(owner(), "cards_only");
    expect(actor.role?.capabilities).toEqual(capabilities);
    const { board } = await seedBoard(owner());
    await expect(createBoard(actor, { title: "Denied" })).rejects.toMatchObject({ type: "denied", details: { rule: "role.capability" } });
    await expect(deleteBoard(actor, { id: board.id, confirmation: board.title })).rejects.toMatchObject({ type: "denied", details: { rule: "role.capability" } });
    expect(await db.board.count()).toBe(1);
  });

  it("scopes deletion to the token workspace and validates creation inputs", async () => {
    const { secret } = await seedAgent(owner(), "agent");
    const { board } = await seedBoard(owner("org_other"));
    const client = await mcpClient(secret);
    try {
      const foreign = await client.call("delete_board", { boardId: board.id, confirmation: board.title });
      expect(foreign.body.error.type).toBe("not_found");
      expect(await db.board.findUnique({ where: { id: board.id } })).not.toBeNull();
      for (const invalid of [{ keyPrefix: "bad" }, { title: " " }, { listTitles: [""] }]) {
        expect((await client.call("create_board", { title: "Demo", externalKey: "invalid", ...invalid })).isError).toBe(true);
      }
      const template = await client.call("create_board", { title: "Template", template: "product_management", externalKey: "template" });
      expect(template.body.lists.map((list: { title: string }) => list.title)).toEqual(["Backlog", "To Do", "In Progress", "In Review", "Ready For Acceptance", "Done"]);
      expect((await client.call("create_board", { title: "Blank", listTitles: [], externalKey: "blank" })).body.lists).toEqual([]);
    } finally { await client.close(); }
  });
});
