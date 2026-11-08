import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase } from "../setup/test-db";
import { owner, seedAgent, mcpClient } from "../setup/fixtures";
import { resetClerk } from "../setup/mock-clerk";
import { MAX_FREE_BOARDS } from "@/constants/boards";

vi.mock("@clerk/nextjs/server", async () =>
  (await import("../setup/mock-clerk")).clerkServerMock,
);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// The approved starting-point contract, exercised through the domain and UI actions.
describe.skipIf(!hasTestDatabase)("board templates", async () => {
  const { db } = await import("@/lib/db");
  const { createBoard } = await import("@/lib/domain/boards");
  const { createCard, moveCard } = await import("@/lib/domain/cards");
  const { createBoard: createAction } = await import("@/actions/create-board");
  const { createList } = await import("@/actions/create-list");
  const { updateList } = await import("@/actions/update-list");
  const { updateListOrder } = await import("@/actions/update-list-order");
  const { deleteList } = await import("@/actions/delete-list");
  const image = { imageId: "i", imageThumbUrl: "t", imageFullUrl: "f", imageUserName: "u", imageLinkHTML: "l" };
  const product = () => createBoard(owner(), { title: "Product work", template: "product_management", image });
  const listsFor = (boardId: string) => db.list.findMany({ where: { boardId }, orderBy: { order: "asc" } });
  const titles = ["Backlog", "To Do", "In Progress", "In Review", "Ready For Acceptance", "Done"];

  beforeEach(() => {
    resetClerk();
    process.env.MCP_ENABLED = "true";
  });

  it("T-1: seeds two boards and reuses workspace labels by name, even concurrently", async () => {
    await db.label.create({ data: { orgId: "org_test", name: "Bug", color: "#123456" } });
    const boards = await Promise.all([product(), product()]);
    expect(boards[0].id).not.toBe(boards[1].id);
    for (const board of boards) {
      expect((await listsFor(board.id)).map((list) => list.title)).toEqual(titles);
      expect(board.notice).toBe("Work moves left to right. In Review is for review of finished work; Ready For Acceptance waits for the owner to accept and move it to Done.");
    }
    const labels = await db.label.findMany({ orderBy: { name: "asc" } });
    expect(labels.map((label) => label.name)).toEqual(["Bug", "Chore", "Feature"]);
    expect(labels[0].color).toBe("#123456");
    expect(await db.agentRole.count()).toBe(0);
  });

  it("T-2: omitted and explicit Blank templates create empty boards", async () => {
    for (const template of [undefined, "blank"] as const) {
      const board = await createBoard(owner(), { title: "Empty", image, template });
      expect(await listsFor(board.id)).toEqual([]);
      expect(board).toMatchObject({ template: "blank", notice: null });
    }
    expect(await db.label.count()).toBe(0);
  });

  it("T-3: rolls back board, lists, labels and audit on a seeding failure; success audits once", async () => {
    await db.$executeRawUnsafe(`ALTER TABLE "Label" ADD CONSTRAINT "test_seed_failure" CHECK ("name" <> 'Chore')`);
    try {
      await expect(product()).rejects.toThrow();
      expect(await db.board.count()).toBe(0);
      expect(await db.list.count()).toBe(0);
      expect(await db.label.count()).toBe(0);
      expect(await db.auditLog.count()).toBe(0);
    } finally {
      await db.$executeRawUnsafe(`ALTER TABLE "Label" DROP CONSTRAINT "test_seed_failure"`);
    }
    const board = await product();
    expect(await db.auditLog.findMany()).toEqual([expect.objectContaining({ entityId: board.id, entityType: "BOARD", action: "CREATE" })]);
  });

  it("T-4/T-6: customization uses ordinary list actions; describe returns the current shape", async () => {
    const board = await product();
    const lists = await listsFor(board.id);
    for (const list of lists) {
      expect((await updateList({ id: list.id, boardId: board.id, title: `${list.title} edited` })).error).toBeUndefined();
    }
    expect((await updateListOrder({ boardId: board.id, lists: lists.map((list, index) => ({ ...list, order: lists.length - index })) })).error).toBeUndefined();
    expect((await createList({ boardId: board.id, title: "Custom" })).error).toBeUndefined();
    for (const list of lists.filter((list) => ["In Review", "Done"].includes(list.title))) {
      expect((await deleteList({ id: list.id, boardId: board.id })).error).toBeUndefined();
    }
    const remaining = await listsFor(board.id);
    const { card } = await createCard(owner(), { listId: remaining[0].id, title: "Work" });
    await moveCard(owner(), { cardId: card.id, toListId: remaining[1].id });
    const { secret } = await seedAgent(owner(), "agent");
    const client = await mcpClient(secret);
    try {
      const { body } = await client.call("describe_workspace");
      expect(body.boards).toEqual([{
        id: board.id, title: board.title, template: "product_management", notice: board.notice,
        lists: remaining.map(({ id, title }) => ({ id, title })),
      }]);
      expect(body.labels.map((label: { name: string }) => label.name)).toEqual(["Bug", "Chore", "Feature"]);
    } finally { await client.close(); }
  });

  it("T-5: a token with move capability can move between every pair of lists, with attribution", async () => {
    const board = await product();
    const lists = await listsFor(board.id);
    const { actor } = await seedAgent(owner(), "agent");
    const { card } = await createCard(owner(), { listId: lists[0].id, title: "Work" });
    for (const from of lists) {
      for (const to of lists.filter((list) => list.id !== from.id)) {
        await moveCard(actor, { cardId: card.id, toListId: from.id });
        await moveCard(actor, { cardId: card.id, toListId: to.id });
        expect(await db.auditLog.findFirst({ where: { entityId: card.id, action: "MOVE", fromListId: from.id, toListId: to.id } })).toMatchObject({ actorKind: "AGENT", tokenId: actor.tokenId, surface: "MCP" });
      }
    }
    await expect(moveCard({ ...actor, role: { ...actor.role!, capabilities: [] } }, { cardId: card.id, toListId: lists[0].id })).rejects.toMatchObject({ type: "denied" });
    await expect(createBoard(actor, { title: "Forbidden", image })).rejects.toMatchObject({ type: "denied" });
  });

  it("T-8: the shared free limit counts Blank and Product management equally", async () => {
    for (let i = 0; i < MAX_FREE_BOARDS; i++) {
      expect((await createAction({ title: "Work", image: "i|t|f|l|u", template: i % 2 ? "blank" : "product_management" })).error).toBeUndefined();
    }
    for (const template of ["blank", "product_management"] as const) {
      expect((await createAction({ title: "Full", image: "i|t|f|l|u", template })).error).toContain("limit of free boards");
    }
    expect(await db.board.count()).toBe(MAX_FREE_BOARDS);
  });
});
