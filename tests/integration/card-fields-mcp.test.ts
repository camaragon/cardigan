import { describe, expect, it, vi } from "vitest";
import { hasTestDatabase } from "../setup/test-db";
import { mcpClient, owner, seedAgent, seedBoard } from "../setup/fixtures";

vi.mock("@clerk/nextjs/server", async () =>
  (await import("../setup/mock-clerk")).clerkServerMock,
);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe.skipIf(!hasTestDatabase)("card fields through MCP and UI", async () => {
  const { updateCard } = await import("@/actions/update-card");
  it("round-trips fields in update/get/list/search, preserves old callers and shares UI versions", async () => {
    process.env.MCP_ENABLED = "true";
    const { board, lists } = await seedBoard(owner());
    const client = await mcpClient((await seedAgent(owner(), "agent")).secret);
    try {
      const created = await client.call("create_cards", { cards: ["Task", "Blocker"].map((title) => ({
        listId: lists.todo.id, title, externalKey: title,
      })) });
      const [card, blocker] = created.body.results.map((r: any) => r.card);
      expect(card).toMatchObject({ priority: "none", assignee: null, blockedByIds: [], blockedBy: [] });
      const edit = await client.call("update_card", {
        cardId: card.id, version: 1, priority: "medium", assignee: "  Demo agent  ", blockedByIds: [blocker.id],
      });
      expect(edit.isError).toBe(false);
      const fields = { version: 2, priority: "medium", assignee: "Demo agent", blockedByIds: [blocker.id],
        blockedBy: [{ id: blocker.id, title: "Blocker" }] };
      expect(edit.body).toMatchObject(fields);
      expect((await client.call("get_card", { cardId: card.id })).body).toMatchObject(fields);
      expect((await client.call("list_cards", { boardId: board.id })).body.cards[0]).toMatchObject(fields);
      expect((await client.call("search_cards", { query: "Task" })).body.cards[0]).toMatchObject(fields);
      const stale = await client.call("update_card", { cardId: card.id, version: 1, priority: "high" });
      expect(stale.body.error).toMatchObject({ type: "stale_version", current: fields });
      const cycle = await client.call("update_card", { cardId: blocker.id, version: 1, blockedByIds: [card.id] });
      expect(cycle.body.error).toMatchObject({ type: "invalid", message: expect.stringContaining("cycle") });
      const ui = await updateCard({ id: card.id, boardId: board.id, version: 2, priority: "high", assignee: "", blockedByIds: [] });
      expect(ui.data).toMatchObject({ version: 3, priority: "high", assignee: null });
      const oldCaller = await client.call("update_card", { cardId: card.id, version: 3, title: "Renamed" });
      expect(oldCaller.body).toMatchObject({ version: 4, title: "Renamed", priority: "high", assignee: null, blockedByIds: [] });
    } finally { await client.close(); }
  });
});
