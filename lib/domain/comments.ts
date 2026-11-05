import { ACTION, COMMENT_KIND, ENTITY_TYPE } from "@prisma/client";
import { db } from "@/lib/db";
import { Actor, keyScope } from "./actor";
import { Tx, writeAudit } from "./audit";
import { loadCard, requireCapability } from "./cards";
import { DomainError } from "./errors";
import { keyedWrite } from "./keys";

interface CommentInput {
  cardId: string;
  body: string;
  kind: COMMENT_KIND;
  duplicateOfCardId?: string;
  externalKey?: string;
}

/** Writes an attributed comment and its audit entry in the caller's transaction. */
export const writeComment = async (
  tx: Tx,
  actor: Actor,
  card: { id: string; title: string },
  input: Omit<CommentInput, "cardId" | "externalKey">,
) => {
  const comment = await tx.comment.create({
    data: {
      orgId: actor.orgId,
      cardId: card.id,
      body: input.body,
      kind: input.kind,
      duplicateOfCardId: input.duplicateOfCardId ?? null,
      actorKind: actor.kind,
      actorId: actor.id,
      actorName: actor.name,
      actorImage: actor.image ?? null,
      surface: actor.surface,
      tokenId: actor.tokenId ?? null,
    },
  });
  await writeAudit(tx, actor, {
    action: ACTION.COMMENT,
    entityType: ENTITY_TYPE.COMMENT,
    entityId: comment.id,
    entityTitle: card.title,
    cardId: card.id,
  });
  return comment;
};

/** A comment under an optional external key: a replay returns the original. */
const keyedComment = (actor: Actor, input: CommentInput) =>
  keyedWrite({
    orgId: actor.orgId,
    scope: keyScope(actor),
    key: input.externalKey,
    payload: {
      cardId: input.cardId,
      body: input.body,
      kind: input.kind,
      duplicateOfCardId: input.duplicateOfCardId ?? null,
    },
    entityType: ENTITY_TYPE.COMMENT,
    tokenId: actor.tokenId,
    replay: (tx, commentId) =>
      tx.comment.findUniqueOrThrow({ where: { id: commentId } }),
    write: async (tx) => {
      const card = await loadCard(tx, actor, input.cardId);
      requireCapability(
        actor,
        input.kind === COMMENT_KIND.DUPLICATE ? "duplicate" : "comment",
      );
      const comment = await writeComment(tx, actor, card, input);
      return { entityId: comment.id, result: comment };
    },
  }).then(({ result, created }) => ({ comment: result, created }));

/** Anyone may comment on any card in their workspace (ADR 0004). */
export const addComment = (
  actor: Actor,
  input: { cardId: string; body: string; externalKey?: string },
) => keyedComment(actor, { ...input, kind: COMMENT_KIND.COMMENT });

/**
 * Marks a card as a duplicate of a canonical card with a comment that
 * references it; neither card is deleted (ADR 0001).
 */
export const markDuplicate = async (
  actor: Actor,
  input: {
    cardId: string;
    canonicalCardId: string;
    note?: string;
    externalKey?: string;
  },
) => {
  if (input.cardId === input.canonicalCardId) {
    throw new DomainError("invalid", "A card cannot duplicate itself");
  }
  const canonical = await loadCard(db, actor, input.canonicalCardId);
  return keyedComment(actor, {
    cardId: input.cardId,
    body: `Duplicate of "${canonical.title}" (${canonical.id})${
      input.note ? `: ${input.note}` : ""
    }`,
    kind: COMMENT_KIND.DUPLICATE,
    duplicateOfCardId: canonical.id,
    externalKey: input.externalKey,
  });
};
