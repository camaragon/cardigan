import { expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ orgId: "org_demo" }),
}));
vi.mock("@/lib/db", () => ({ db: { list: { findMany } } }));
vi.mock(
  "@/app/(platform)/(dashboard)/board/[boardId]/_components/list-container",
  () => ({ ListContainer: () => null }),
);

import BoardPage from "@/app/(platform)/(dashboard)/board/[boardId]/page";

it("loads comment counts with cards within the active workspace", async () => {
  findMany.mockResolvedValue([]);
  await BoardPage({ params: Promise.resolve({ boardId: "board_demo" }) });
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { boardId: "board_demo", board: { orgId: "org_demo" } },
      include: {
        cards: expect.objectContaining({
          include: expect.objectContaining({
            _count: { select: { comments: true } },
          }),
        }),
      },
    }),
  );
});
