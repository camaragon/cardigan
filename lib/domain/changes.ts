import { OUTCOME } from "@prisma/client";
import { db } from "@/lib/db";
import { Actor } from "./actor";
import { DomainError } from "./errors";
import { LIMITS } from "./limits";

/**
 * The changes query (PRD C-7): successful events in the actor's workspace
 * after a cursor, in event id order. Event ids are assigned in commit order
 * (see writeAudit), so paging from any cursor returns each event once.
 */
export const getChanges = async (
  actor: Actor,
  options: { cursor?: string; limit?: number } = {},
) => {
  const after = options.cursor ? Number(options.cursor) : 0;
  if (!Number.isInteger(after) || after < 0) {
    throw new DomainError("invalid", "cursor must be a value from nextCursor");
  }
  const limit = Math.min(Math.max(options.limit ?? LIMITS.page, 1), LIMITS.page);

  const entries = await db.auditLog.findMany({
    where: {
      orgId: actor.orgId,
      outcome: OUTCOME.OK,
      eventId: { gt: after },
    },
    orderBy: { eventId: "asc" },
    take: limit + 1,
  });
  const page = entries.slice(0, limit);

  return {
    events: page.map((e) => ({
      eventId: e.eventId!,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      title: e.entityTitle,
      cardId: e.cardId,
      fromListId: e.fromListId,
      toListId: e.toListId,
      position: e.position,
      actor: {
        kind: e.actorKind,
        name: e.userName,
        role: e.agentRole,
        surface: e.surface,
      },
      at: e.createdAt.toISOString(),
    })),
    nextCursor: String(page.at(-1)?.eventId ?? after),
    hasMore: entries.length > limit,
  };
};
