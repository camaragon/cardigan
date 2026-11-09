import { Actor } from "./actor";
import { Tx } from "./audit";
import { DomainError, notFound } from "./errors";

/** Caller holds the workspace dependency lock until commit. */
export const validateBlockers = async (
  tx: Tx, actor: Actor, cardId: string, blockerIds: string[],
) => {
  if (blockerIds.includes(cardId)) {
    throw new DomainError("invalid", "A card cannot be blocked by itself");
  }
  const count = await tx.card.count({
    where: { id: { in: blockerIds }, list: { board: { orgId: actor.orgId } } },
  });
  if (count !== blockerIds.length) throw notFound("Blocked-by card in this workspace");

  const cycles = await tx.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE reachable(id) AS (
      SELECT unnest(${blockerIds}::text[])
      UNION
      SELECT d."blockerId" FROM "CardDependency" d JOIN reachable r ON d."cardId" = r.id
    ) SELECT id FROM reachable WHERE id = ${cardId} LIMIT 1
  `;
  if (cycles.length) {
    throw new DomainError("invalid", "Blocked-by links cannot form a cycle");
  }
};
