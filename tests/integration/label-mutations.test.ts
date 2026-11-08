import { afterEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase } from "../setup/test-db";
import { agent, member } from "../setup/fixtures";
import * as audit from "@/lib/domain/audit";
import { createLabel, updateLabel } from "@/lib/domain/labels";
import { db } from "@/lib/db";

afterEach(() => vi.restoreAllMocks());
describe.skipIf(!hasTestDatabase)("transactional label mutations", () => {
  it("lets members create duplicate names and rename/recolor with attributed events", async () => {
    const actor = member();
    const label = await createLabel(actor, { name: "Review", color: "red" });
    await createLabel(actor, { name: "Review", color: "blue" });
    const updated = await updateLabel(actor, { id: label.id, name: "Ready", color: "green" });
    expect(updated).toMatchObject({ name: "Ready", color: "green", orgId: actor.orgId });
    expect(await db.auditLog.findMany({ orderBy: { eventId: "asc" } })).toMatchObject([
      { action: "CREATE", eventId: 1, entityId: label.id, actorKind: "MEMBER" },
      { action: "CREATE", eventId: 2 },
      { action: "UPDATE", eventId: 3, entityId: label.id, entityTitle: "Ready" },
    ]);
    await expect(updateLabel(member("other"), { id: label.id, name: "Denied", color: "red" })).rejects.toThrow();
    await expect(updateLabel(agent(), { id: label.id, name: "Denied", color: "red" })).rejects.toMatchObject({ type: "denied" });
    await expect(createLabel(agent(), { name: "Denied", color: "red" })).rejects.toMatchObject({ type: "denied" });
    expect(await db.label.findUnique({ where: { id: label.id } })).toEqual(updated);
    expect(await db.auditLog.count()).toBe(3);
  });

  it("rolls back creation and rename/recolor when audit insertion fails", async () => {
    const actor = member();
    const label = await createLabel(actor, { name: "Review", color: "red" });
    vi.spyOn(audit, "writeAudit").mockRejectedValue(new Error("audit unavailable"));
    await expect(createLabel(actor, { name: "Lost", color: "blue" })).rejects.toThrow("audit unavailable");
    await expect(updateLabel(actor, { id: label.id, name: "Lost", color: "green" })).rejects.toThrow("audit unavailable");
    expect(await db.label.findMany()).toEqual([label]);
    expect(await db.auditLog.count()).toBe(1);
  });
});
