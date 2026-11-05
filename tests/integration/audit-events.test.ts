import { describe, expect, it, vi } from "vitest";
import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { hasTestDatabase } from "../setup/test-db";
import { owner } from "../setup/actors";

vi.mock("@clerk/nextjs/server", async () =>
  (await import("../setup/mock-clerk")).clerkServerMock,
);

describe.skipIf(!hasTestDatabase)("audit events and the changes query", async () => {
  const { db } = await import("@/lib/db");
  const { transaction, writeAudit } = await import("@/lib/domain/audit");
  const { getChanges } = await import("@/lib/domain/changes");

  const event = (i: number) =>
    transaction((tx) =>
      writeAudit(tx, owner(), {
        action: ACTION.CREATE,
        entityType: ENTITY_TYPE.CARD,
        entityId: `card-${i}`,
        entityTitle: `Card ${i}`,
      }),
    );

  it("C-7: paging from any cursor while events are written returns each event id once, in order", async () => {
    for (let i = 0; i < 3; i++) await event(i);
    const seen: number[] = [];
    let cursor: string | undefined;
    let i = 3;
    for (;;) {
      // Concurrent writers while paging.
      const writes = i < 15 ? [event(i++), event(i++), event(i++)] : [];
      const page = await getChanges(owner(), { cursor, limit: 2 });
      await Promise.all(writes);
      seen.push(...page.events.map((e) => e.eventId));
      cursor = page.nextCursor;
      if (!page.hasMore && writes.length === 0) {
        const tail = await getChanges(owner(), { cursor, limit: 50 });
        seen.push(...tail.events.map((e) => e.eventId));
        break;
      }
    }
    const all = await db.auditLog.findMany({
      where: { orgId: "org_test", eventId: { not: null } },
      orderBy: { eventId: "asc" },
    });
    expect(all).toHaveLength(15);
    expect(seen).toEqual(all.map((e) => e.eventId));
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("C-7: event ids are per workspace and never leak across workspaces", async () => {
    await event(1);
    await transaction((tx) =>
      writeAudit(tx, owner("org_other", "user_other"), {
        action: ACTION.CREATE,
        entityType: ENTITY_TYPE.CARD,
        entityId: "other",
        entityTitle: "Other",
      }),
    );
    const page = await getChanges(owner());
    expect(page.events.map((e) => e.entityId)).toEqual(["card-1"]);
  });
});
