import { ACTION, ENTITY_TYPE, OUTCOME, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { Actor } from "./actor";

export type Tx = Prisma.TransactionClient;

export interface AuditEntry {
  action: ACTION;
  entityType: ENTITY_TYPE;
  entityId: string;
  entityTitle: string;
  cardId?: string;
  fromListId?: string;
  toListId?: string;
  position?: number;
  tool?: string;
  /** Workspace the entry belongs to; defaults to the actor's. */
  orgId?: string;
}

const actorFields = (actor: Actor) => ({
  userId: actor.id,
  userName: actor.name,
  userImage: actor.image ?? "",
  actorKind: actor.kind,
  surface: actor.surface,
  tokenId: actor.tokenId ?? null,
  agentRole: actor.role?.key ?? null,
});

/**
 * Writes an attributed audit entry inside the caller's transaction and gives
 * it the workspace's next event id. The advisory lock is held until commit,
 * so event ids are assigned in commit order per workspace and a reader paging
 * the changes query never sees a gap fill in later (ADR 0001, PRD C-7).
 */
export const writeAudit = async (tx: Tx, actor: Actor, entry: AuditEntry) => {
  const orgId = entry.orgId ?? actor.orgId;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`audit:${orgId}`}))`;
  const last = await tx.auditLog.aggregate({
    where: { orgId },
    _max: { eventId: true },
  });
  const { orgId: _ignored, ...rest } = entry;
  void _ignored;
  return tx.auditLog.create({
    data: {
      ...rest,
      orgId,
      ...actorFields(actor),
      eventId: (last._max.eventId ?? 0) + 1,
    },
  });
};

/**
 * Records a failed agent call (ADR 0001): one entry with the outcome and error
 * type, no event id, so it stays out of the changes query.
 */
export const recordFailedCall = async (
  actor: Actor,
  tool: string,
  errorType: string,
) => {
  try {
    await db.auditLog.create({
      data: {
        orgId: actor.orgId,
        action: ACTION.CALL,
        entityType: ENTITY_TYPE.CARD,
        entityId: "",
        entityTitle: tool,
        ...actorFields(actor),
        outcome: OUTCOME.FAILED,
        errorType,
        tool,
      },
    });
  } catch (error) {
    console.error("[FAILED_CALL_AUDIT_ERROR]", error);
  }
};

/** Runs a domain mutation in one transaction (mutation and audit together). */
export const transaction = <T>(fn: (tx: Tx) => Promise<T>) =>
  db.$transaction(fn, { timeout: 15_000 });
