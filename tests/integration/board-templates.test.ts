import { describe, expect, it, vi } from "vitest";
import { hasTestDatabase } from "../setup/test-db";
import { member, owner, seedBoard } from "../setup/fixtures";

vi.mock("@clerk/nextjs/server", async () =>
  (await import("../setup/mock-clerk")).clerkServerMock,
);

describe.skipIf(!hasTestDatabase)("board templates", async () => {
  const { db } = await import("@/lib/db");
  const { createBoard, listBoardsWithRules } = await import("@/lib/domain/boards");

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

  it("C-8: rules come from the template and are readable as settings", async () => {
    await seedBoard(owner(), "product");
    await seedBoard(owner(), "plain");
    const boards = await listBoardsWithRules(owner());
    const product = boards.find((b) => b.template === "product")!;
    const queued = product.lists.find((l) => l.key === "queued")!;
    expect(queued.rules.create).toEqual(["the owner"]);
    expect(queued.rules.moveTo.in_flight).toEqual(["Supervisor agents", "the owner"]);
    const plain = boards.find((b) => b.template === "plain")!;
    expect(plain.lists.map((l) => l.rules.create)).toEqual([
      ["anyone in the workspace"],
      ["anyone in the workspace"],
      ["anyone in the workspace"],
    ]);
  });
});
