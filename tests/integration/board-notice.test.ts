import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase } from "../setup/test-db";
import { clerkState, resetClerk } from "../setup/mock-clerk";
import { mcpClient, owner, seedAgent } from "../setup/fixtures";

vi.mock("@clerk/nextjs/server", async () =>
  (await import("../setup/mock-clerk")).clerkServerMock,
);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe.skipIf(!hasTestDatabase)("board notice", async () => {
  const { db } = await import("@/lib/db");
  const { createBoard } = await import("@/lib/domain/boards");
  const { updateBoard } = await import("@/actions/update-board");
  beforeEach(() => { resetClerk(); process.env.MCP_ENABLED = "true"; });

  it("T-7: people edit and clear notices; agents and other workspaces cannot change them", async () => {
    const board = await createBoard(owner(), {
      title: "Demo work", template: "product_management",
      image: { imageId: "i", imageThumbUrl: "t", imageFullUrl: "f", imageUserName: "u", imageLinkHTML: "l" },
    });
    clerkState.orgRole = "org:member";
    expect((await updateBoard({ id: board.id, notice: "  Our convention  " })).data?.notice).toBe("Our convention");
    expect((await updateBoard({ id: board.id, notice: "x".repeat(2001) })).fieldErrors?.notice).toBeTruthy();
    expect((await updateBoard({ id: board.id, title: "Renamed" })).data?.notice).toBe("Our convention");

    clerkState.orgId = "org_other";
    expect((await updateBoard({ id: board.id, notice: "Forbidden" })).error).toBeTruthy();
    clerkState.userId = null;
    expect((await updateBoard({ id: board.id, notice: "Forbidden" })).error).toBe("Unauthorized");
    resetClerk();
    const { secret } = await seedAgent(owner(), "agent");
    const client = await mcpClient(secret);
    try {
      const tools = await client.client.listTools();
      expect(tools.tools.some((tool) => /board|notice/.test(tool.name))).toBe(false);
      expect((await db.board.findUniqueOrThrow({ where: { id: board.id } })).notice).toBe("Our convention");
    } finally { await client.close(); }
    expect((await updateBoard({ id: board.id, notice: " " })).data?.notice).toBeNull();
  });
});
