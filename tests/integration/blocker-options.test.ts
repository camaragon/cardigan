import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase } from "../setup/test-db";
import { clerkState, resetClerk } from "../setup/mock-clerk";
import { owner, seedBoard } from "../setup/fixtures";

vi.mock("@clerk/nextjs/server", async () =>
  (await import("../setup/mock-clerk")).clerkServerMock,
);

describe.skipIf(!hasTestDatabase)("workspace blocker picker", async () => {
  const { db } = await import("@/lib/db");
  const { GET } = await import("@/app/api/cards/blocker-options/route");
  const read = (query = "") => GET(new Request(`http://localhost/api/cards/blocker-options?query=${query}`));
  beforeEach(resetClerk);

  it("requires a session and scopes title search to the current workspace across boards", async () => {
    const local = await seedBoard(owner());
    const otherBoard = await seedBoard(owner());
    const foreign = await seedBoard(owner("org_foreign"));
    for (const [i, board] of [local, otherBoard, foreign].entries()) {
      await db.card.create({ data: { id: `option-${i}`, title: "Release check", order: 0, listId: board.lists.todo.id } });
    }
    expect((await (await read("release")).json()).cards.map((c: { id: string }) => c.id)).toEqual(["option-0", "option-1"]);
    expect((await (await read("missing")).json()).cards).toEqual([]);
    clerkState.userId = null;
    expect((await read()).status).toBe(401);
    resetClerk();
    clerkState.orgId = null;
    expect((await read()).status).toBe(401);
    resetClerk();
    expect((await read("x".repeat(201))).status).toBe(400);
  });
});
