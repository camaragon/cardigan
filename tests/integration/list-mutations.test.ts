import { afterEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase } from "../setup/test-db";
import { agent, member, seedBoard } from "../setup/fixtures";
import * as audit from "@/lib/domain/audit";
import { createList, reorderLists, updateList } from "@/lib/domain/lists";
import { getChanges } from "@/lib/domain/changes";
import { db } from "@/lib/db";

afterEach(() => vi.restoreAllMocks());
describe.skipIf(!hasTestDatabase)("transactional list mutations", () => {
  it("lets members create, rename and reorder with change-feed events", async () => {
    const actor = member();
    const { board, lists } = await seedBoard(actor);
    const created = await createList(actor, { boardId: board.id, title: "Custom" });
    await updateList(actor, { id: created.id, boardId: board.id, title: "Renamed" });
    const cursor = (await getChanges(actor)).nextCursor;
    const order = [created, lists.done, lists.doing, lists.todo].map((list, order) => ({ id: list.id, order }));
    await reorderLists(actor, { boardId: board.id, lists: order });
    expect((await db.list.findMany({ where: { boardId: board.id }, orderBy: { order: "asc" } })).map((l) => l.id)).toEqual(order.map((l) => l.id));
    expect((await getChanges(actor, { cursor })).events).toMatchObject([{ action: "UPDATE", entityType: "BOARD", entityId: board.id, actor: { kind: "MEMBER" } }]);
    expect(await db.auditLog.count()).toBe(3);
  });

  it("rejects wrong-board, duplicate, incomplete and invalid-position permutations without writes", async () => {
    const actor = member();
    const { board, lists } = await seedBoard(actor);
    const other = await seedBoard(actor);
    const original = Object.values(lists);
    const valid = original.map((list, order) => ({ id: list.id, order }));
    for (const submitted of [
      [...valid.slice(0, 2), { id: other.lists.todo.id, order: 2 }],
      [valid[0], valid[0], valid[2]], valid.slice(1),
      valid.map((l) => ({ ...l, order: 0 })),
      valid.map((l) => ({ ...l, order: l.order - 1 })),
      valid.map((l) => ({ ...l, order: l.order + 0.5 })),
    ]) {
      await expect(reorderLists(actor, { boardId: board.id, lists: submitted })).rejects.toMatchObject({ type: "invalid" });
    }
    await expect(reorderLists(member("other"), { boardId: board.id, lists: valid })).rejects.toMatchObject({ type: "not_found" });
    await expect(createList(agent(), { boardId: board.id, title: "Denied" })).rejects.toMatchObject({ type: "denied" });
    expect(await db.list.findMany({ where: { boardId: board.id }, orderBy: { order: "asc" } })).toEqual(original);
    expect(await db.auditLog.count()).toBe(0);
  });

  it("rolls back create, rename and reorder when audit insertion fails", async () => {
    const actor = member();
    const { board, lists } = await seedBoard(actor);
    vi.spyOn(audit, "writeAudit").mockRejectedValue(new Error("audit unavailable"));
    await expect(createList(actor, { boardId: board.id, title: "Lost" })).rejects.toThrow("audit unavailable");
    await expect(updateList(actor, { id: lists.todo.id, boardId: board.id, title: "Lost" })).rejects.toThrow("audit unavailable");
    await expect(reorderLists(actor, { boardId: board.id, lists: Object.values(lists).map((l, i) => ({ id: l.id, order: 3 - i })) })).rejects.toThrow("audit unavailable");
    expect(await db.list.findMany({ where: { boardId: board.id }, orderBy: { order: "asc" } })).toEqual(Object.values(lists));
    expect(await db.auditLog.count()).toBe(0);
  });
});
