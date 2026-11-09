import { describe, expect, it, vi } from "vitest";
import { hasTestDatabase } from "../setup/test-db";
import { agent, owner, seedBoard } from "../setup/fixtures";
import * as audit from "@/lib/domain/audit";

describe.skipIf(!hasTestDatabase)("card fields (A-2 subset)", async () => {
  const { db } = await import("@/lib/db");
  const { createCard, loadCard, updateCard } = await import("@/lib/domain/cards");
  const { deleteCard } = await import("@/lib/domain/deletes");
  const makeCards = async () => {
    const { lists } = await seedBoard(owner());
    return Promise.all(["A", "B", "C"].map(async (title) =>
      (await createCard(owner(), { listId: lists.todo.id, title })).card));
  };

  it("edits fields with a version bump, normalized assignee and one attributed changes event", async () => {
    const [a, b] = await makeCards();
    expect(a).toMatchObject({ priority: "none", assignee: null, blockedBy: [] });
    const updated = await updateCard(agent(), {
      cardId: a.id, expectedVersion: 1, priority: "high", assignee: "  Review agent  ",
      blockedByIds: [b.id, b.id],
    });
    expect(updated).toMatchObject({ version: 2, priority: "high", assignee: "Review agent" });
    expect(updated.blockedBy.map((d) => d.blockerId)).toEqual([b.id]);
    const events = await db.auditLog.findMany({ where: { entityId: a.id, action: "UPDATE" } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorKind: "AGENT", tokenId: agent().id, surface: "MCP" });
    expect(events[0].eventId).toBeGreaterThan(0);

    await expect(updateCard(agent(), { cardId: a.id, expectedVersion: 1, priority: "low", blockedByIds: [] }))
      .rejects.toMatchObject({ type: "stale_version", details: { current: { version: 2 } } });
    expect((await loadCard(db, owner(), a.id)).blockedBy).toHaveLength(1);
    expect(await db.auditLog.count({ where: { entityId: a.id, action: "UPDATE" } })).toBe(1);
    expect(await updateCard(owner(), { cardId: a.id, expectedVersion: 2, assignee: "  ", blockedByIds: [] }))
      .toMatchObject({ version: 3, assignee: null, blockedBy: [] });
    await expect(updateCard(owner(), { cardId: a.id, assignee: "a".repeat(81) })).rejects.toMatchObject({ type: "invalid" });
  });

  it("accepts 50 blockers and rejects oversized edits before changing the card or audit", async () => {
    const [a] = await makeCards();
    const ids = Array.from({ length: 51 }, (_, i) => `blocker-${i}`);
    await db.card.createMany({ data: ids.map((id, order) => ({ id, title: id, order, listId: a.listId })) });
    const updated = await updateCard(agent(), { cardId: a.id, blockedByIds: ids.slice(0, 50) });
    expect(updated.blockedBy).toHaveLength(50);
    await expect(updateCard(agent(), { cardId: a.id, expectedVersion: 2, blockedByIds: ids }))
      .rejects.toMatchObject({ type: "invalid", message: "A card can have at most 50 blocked-by cards" });
    expect(await loadCard(db, owner(), a.id)).toMatchObject({ version: 2, blockedBy: updated.blockedBy });
    expect(await db.auditLog.count({ where: { entityId: a.id, action: "UPDATE" } })).toBe(1);
  });

  it("rejects self-links, indirect cycles and concurrent opposite links", async () => {
    const [a, b, c] = await makeCards();
    await expect(updateCard(agent(), { cardId: a.id, blockedByIds: [a.id] }))
      .rejects.toMatchObject({ type: "invalid", message: expect.stringContaining("itself") });
    await updateCard(agent(), { cardId: a.id, blockedByIds: [b.id] });
    await updateCard(agent(), { cardId: b.id, blockedByIds: [c.id] });
    await expect(updateCard(agent(), { cardId: c.id, blockedByIds: [a.id] }))
      .rejects.toMatchObject({ type: "invalid", message: expect.stringContaining("cycle") });
    await updateCard(owner(), { cardId: a.id, blockedByIds: [] });
    await updateCard(owner(), { cardId: b.id, blockedByIds: [] });
    const results = await Promise.allSettled([
      updateCard(agent(), { cardId: a.id, blockedByIds: [b.id] }),
      updateCard(agent(), { cardId: b.id, blockedByIds: [a.id] }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { type: "invalid" } });
  });

  it("allows same-workspace boards, hides foreign blockers, enforces edit capability and cascades both directions", async () => {
    const [a, b, c] = await makeCards();
    const other = await seedBoard(owner(), "Other board");
    const foreign = await seedBoard(owner("org_foreign"));
    const same = (await createCard(owner(), { listId: other.lists.todo.id, title: "Same workspace" })).card;
    const hidden = (await createCard(owner("org_foreign"), { listId: foreign.lists.todo.id, title: "Foreign" })).card;
    for (const blockerId of [hidden.id, "missing"]) {
      await expect(updateCard(agent(), { cardId: a.id, blockedByIds: [blockerId] }))
        .rejects.toMatchObject({ type: "not_found" });
    }
    const restricted = { ...agent(), role: { key: "reader", name: "Reader", capabilities: [] } };
    await expect(updateCard(restricted, { cardId: a.id, priority: "high" })).rejects.toMatchObject({ type: "denied" });
    await updateCard(agent(), { cardId: a.id, blockedByIds: [b.id, same.id] });
    await updateCard(agent(), { cardId: c.id, blockedByIds: [a.id] });
    await deleteCard(owner(), { id: a.id });
    expect(await db.cardDependency.count()).toBe(0);
  });

  it("rolls back fields and dependency replacements when audit fails", async () => {
    const [a, b] = await makeCards();
    const spy = vi.spyOn(audit, "writeAudit").mockRejectedValueOnce(new Error("audit unavailable"));
    try {
      await expect(updateCard(owner(), { cardId: a.id, priority: "high", blockedByIds: [b.id] }))
        .rejects.toThrow("audit unavailable");
      expect(await loadCard(db, owner(), a.id)).toMatchObject({ version: 1, priority: "none", blockedBy: [] });
    } finally { spy.mockRestore(); }
  });
});
