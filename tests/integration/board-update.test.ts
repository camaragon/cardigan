import { afterEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase } from "../setup/test-db";
import { agent, member, seedBoard } from "../setup/fixtures";
import * as audit from "@/lib/domain/audit";
import { updateBoard } from "@/lib/domain/boards";
import { db } from "@/lib/db";

afterEach(() => vi.restoreAllMocks());
describe.skipIf(!hasTestDatabase)("transactional board update", () => {
  it("preserves member access, normalizes empty notices and audits image/title changes", async () => {
    const actor = member();
    const { board } = await seedBoard(actor);
    await updateBoard(actor, { id: board.id, notice: "Guidance" });
    const updated = await updateBoard(actor, { id: board.id, notice: "", title: "Renamed", image: "img|thumb|full|link|artist" });
    expect(updated).toMatchObject({ title: "Renamed", notice: null, imageUserName: "artist" });
    expect(await db.auditLog.findMany({ orderBy: { eventId: "asc" } })).toMatchObject([
      { eventId: 1, entityId: board.id, actorKind: "MEMBER", action: "UPDATE" },
      { eventId: 2, entityId: board.id, entityTitle: "Renamed" },
    ]);
    await expect(updateBoard(member("other"), { id: board.id, notice: "Denied" })).rejects.toThrow();
    await expect(updateBoard(agent(), { id: board.id, notice: "Denied" })).rejects.toMatchObject({ type: "denied" });
    expect(await db.board.findUnique({ where: { id: board.id } })).toEqual(updated);
    expect(await db.auditLog.count()).toBe(2);
  });

  it("rolls back notice, title and image when audit insertion fails", async () => {
    const actor = member();
    const { board } = await seedBoard(actor);
    vi.spyOn(audit, "writeAudit").mockRejectedValue(new Error("audit unavailable"));
    await expect(updateBoard(actor, { id: board.id, notice: "Lost", title: "Lost", image: "img|new-thumb|new-full|link|artist" })).rejects.toThrow("audit unavailable");
    expect(await db.board.findUnique({ where: { id: board.id } })).toEqual(board);
    expect(await db.auditLog.count()).toBe(0);
  });
});
