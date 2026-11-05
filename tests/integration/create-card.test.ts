import { beforeEach, describe, expect, it, vi } from "vitest";
import { clerkState, resetClerk } from "../setup/mock-clerk";
import { hasTestDatabase } from "../setup/test-db";

vi.mock("@clerk/nextjs/server", async () =>
  (await import("../setup/mock-clerk")).clerkServerMock,
);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe.skipIf(!hasTestDatabase)("createCard action (database)", async () => {
  const { db } = await import("@/lib/db");
  const { createCard } = await import("@/actions/create-card");

  async function seedList(orgId = "org_test") {
    const board = await db.board.create({
      data: {
        orgId,
        title: "Board",
        imageId: "img",
        imageThumbUrl: "thumb",
        imageFullUrl: "full",
        imageUserName: "user",
        imageLinkHTML: "link",
      },
    });
    const list = await db.list.create({
      data: { title: "Todo", order: 1, boardId: board.id },
    });
    return { boardId: board.id, listId: list.id };
  }

  beforeEach(() => resetClerk());

  it("appends cards with increasing order and writes audit logs", async () => {
    const ids = await seedList();

    for (const title of ["First", "Second", "Third"]) {
      const result = await createCard({ ...ids, title });
      expect(result.error).toBeUndefined();
    }

    const cards = await db.card.findMany({
      where: { listId: ids.listId },
      orderBy: { order: "asc" },
    });
    expect(cards.map((c) => [c.title, c.order])).toEqual([
      ["First", 1],
      ["Second", 2],
      ["Third", 3],
    ]);

    const logs = await db.auditLog.findMany({ where: { entityType: "CARD" } });
    expect(logs).toHaveLength(3);
    expect(logs.every((l) => l.orgId === "org_test" && l.action === "CREATE")).toBe(true);
  });

  it("continues after the highest existing order", async () => {
    const ids = await seedList();
    await db.card.create({ data: { title: "Existing", order: 7, listId: ids.listId } });

    const result = await createCard({ ...ids, title: "Next" });
    expect(result.data?.order).toBe(8);
  });

  it("returns field errors without touching the database", async () => {
    const ids = await seedList();
    const result = await createCard({ ...ids, title: "" });

    expect(result.fieldErrors?.title).toBeDefined();
    expect(await db.card.count()).toBe(0);
  });

  it("refuses a list from another organization", async () => {
    const ids = await seedList("org_other");
    const result = await createCard({ ...ids, title: "Sneaky" });

    expect(result.error).toBe("List not found");
    expect(await db.card.count()).toBe(0);
  });

  it("refuses unauthenticated calls", async () => {
    const ids = await seedList();
    clerkState.userId = null;

    const result = await createCard({ ...ids, title: "Anonymous" });
    expect(result.error).toBe("Unauthorized");
  });
});
