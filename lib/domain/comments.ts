import { ACTION, COMMENT_KIND, ENTITY_TYPE } from "@prisma/client";
import { Actor, keyScope } from "./actor";
import { Tx, writeAudit } from "./audit";
import { loadCard, requireCapability } from "./cards";
import { DomainError, isDomainError } from "./errors";
import { keyedWrite } from "./keys";

interface CommentInput {
  cardId: string;
  /** Comment text, or the caller's duplicate note before its reference is rendered. */
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
      ...(input.kind === COMMENT_KIND.DUPLICATE ? { intentVersion: 2 } : {}),
      cardId: input.cardId,
      body: input.body,
      kind: input.kind,
      duplicateOfCardId: input.duplicateOfCardId ?? null,
    },
    entityType: ENTITY_TYPE.COMMENT,
    tokenId: actor.tokenId,
    legacyPayload: input.kind === COMMENT_KIND.DUPLICATE ? async (tx, commentId) => {
      const comment = await tx.comment.findFirst({ where: { id: commentId, orgId: actor.orgId } });
      if (!comment) throw new DomainError("not_found", "Original comment target no longer exists");
      // Old receipts hashed the generated body; use the stored title, never today's title.
      const reference = `" (${input.duplicateOfCardId})`;
      const titleEnd = comment.body.indexOf(reference);
      if (comment.cardId !== input.cardId || comment.kind !== COMMENT_KIND.DUPLICATE ||
          comment.duplicateOfCardId !== input.duplicateOfCardId ||
          !comment.body.startsWith('Duplicate of "') || titleEnd < 0 ||
          titleEnd !== comment.body.lastIndexOf(reference) ||
          comment.body.slice(titleEnd + reference.length) !== (input.body ? `: ${input.body}` : "")) {
        return undefined;
      }
      return {
        cardId: input.cardId, body: comment.body, kind: input.kind,
        duplicateOfCardId: input.duplicateOfCardId,
      };
    } : undefined,
    replay: async (tx, commentId) => {
      const comment = await tx.comment.findFirst({ where: { id: commentId, orgId: actor.orgId } });
      if (!comment) throw new DomainError("not_found", "Original comment target no longer exists");
      if (input.duplicateOfCardId) {
        try {
          await loadCard(tx, actor, input.duplicateOfCardId);
        } catch (error) {
          if (isDomainError(error) && error.type === "not_found") {
            throw new DomainError("not_found", "Original canonical card no longer exists");
          }
          throw error;
        }
      }
      return comment;
    },
    write: async (tx) => {
      const card = await loadCard(tx, actor, input.cardId);
      requireCapability(
        actor,
        input.kind === COMMENT_KIND.DUPLICATE ? "duplicate" : "comment",
      );
      let body = input.body;
      if (input.duplicateOfCardId) {
        const canonical = await loadCard(tx, actor, input.duplicateOfCardId);
        body = `Duplicate of "${canonical.title}" (${canonical.id})${input.body ? `: ${input.body}` : ""}`;
      }
      const comment = await writeComment(tx, actor, card, { ...input, body });
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
  return keyedComment(actor, {
    cardId: input.cardId,
    body: input.note || "",
    kind: COMMENT_KIND.DUPLICATE,
    duplicateOfCardId: input.canonicalCardId,
    externalKey: input.externalKey,
  });
};
