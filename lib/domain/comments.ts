import { ACTION, COMMENT_KIND, ENTITY_TYPE } from "@prisma/client";
import { db } from "@/lib/db";
import { Actor, keyScope } from "./actor";
import { transaction, Tx, writeAudit } from "./audit";
import { denied, DomainError, notFound } from "./errors";
import {
  findExternalKey,
  hashPayload,
  isUniqueViolation,
  saveExternalKey,
} from "./keys";
import { enforce } from "./cards";
import { checkComment } from "./rules";
import { LIMITS, checkText } from "./limits";

const loadCard = async (tx: Tx | typeof db, actor: Actor, cardId: string) => {
  const card = await tx.card.findFirst({
    where: { id: cardId, list: { board: { orgId: actor.orgId } } },
    include: { list: { include: { board: true } } },
  });
  if (!card) throw notFound("Card");
  return card;
};

interface WriteCommentInput {
  cardId: string;
  body: string;
  kind: COMMENT_KIND;
  duplicateOfCardId?: string;
  externalKey?: string;
}

const writeComment = async (
  tx: Tx,
  actor: Actor,
  card: { id: string; title: string },
  input: WriteCommentInput,
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

/** Runs a keyed comment write: a replay with the same payload returns the original. */
const keyedComment = async (
  actor: Actor,
  input: WriteCommentInput,
  authorize: (tx: Tx, card: Awaited<ReturnType<typeof loadCard>>) => Promise<void>,
) => {
  const run = () =>
    transaction(async (tx) => {
      const card = await loadCard(tx, actor, input.cardId);
      const scope = keyScope(actor);
      const payloadHash = hashPayload({
        cardId: input.cardId,
        body: input.body,
        kind: input.kind,
        duplicateOfCardId: input.duplicateOfCardId ?? null,
      });
      if (input.externalKey) {
        const existing = await findExternalKey(
          tx,
          actor.orgId,
          scope,
          input.externalKey,
          payloadHash,
        );
        if (existing) {
          const comment = await tx.comment.findUniqueOrThrow({
            where: { id: existing.entityId },
          });
          return { comment, created: false };
        }
      }
      await authorize(tx, card);
      const comment = await writeComment(tx, actor, card, input);
      if (input.externalKey) {
        await saveExternalKey(tx, {
          orgId: actor.orgId,
          scope,
          key: input.externalKey,
          payloadHash,
          entityType: ENTITY_TYPE.COMMENT,
          entityId: comment.id,
          tokenId: actor.tokenId,
        });
      }
      return { comment, created: true };
    });

  try {
    return await run();
  } catch (error) {
    if (isUniqueViolation(error)) return run();
    throw error;
  }
};

/** Anyone may comment on any card in their workspace (ADR 0004). */
export const addComment = (
  actor: Actor,
  input: { cardId: string; body: string; externalKey?: string },
) => {
  checkText("body", input.body, LIMITS.comment);
  return keyedComment(
    actor,
    { ...input, kind: COMMENT_KIND.COMMENT },
    async () => {
      const denial = checkComment(actor);
      if (denial) throw denied("Not allowed to comment", denial);
    },
  );
};

/**
 * Marks a card as a duplicate of a canonical card with a comment that
 * references it; neither card is deleted (ADR 0001). The duplicate must be a
 * card the actor may edit; the canonical card may be in any list.
 */
export const markDuplicate = (
  actor: Actor,
  input: {
    cardId: string;
    canonicalCardId: string;
    note?: string;
    externalKey?: string;
  },
) => {
  if (input.note) checkText("note", input.note, LIMITS.comment);
  if (input.cardId === input.canonicalCardId) {
    throw new DomainError("invalid", "A card cannot duplicate itself");
  }

  return loadCard(db, actor, input.canonicalCardId).then((canonical) =>
    keyedComment(
      actor,
      {
        cardId: input.cardId,
        body: `Duplicate of "${canonical.title}" (${canonical.id})${
          input.note ? `: ${input.note}` : ""
        }`,
        kind: COMMENT_KIND.DUPLICATE,
        duplicateOfCardId: canonical.id,
        externalKey: input.externalKey,
      },
      (tx, card) =>
        enforce(
          tx,
          actor,
          { kind: "duplicate", list: card.list },
          card.list.board.template,
        ),
    ),
  );
};

export const listComments = async (actor: Actor, cardId: string) => {
  const card = await db.card.findFirst({
    where: { id: cardId, list: { board: { orgId: actor.orgId } } },
    select: { id: true },
  });
  if (!card) throw notFound("Card");
  return db.comment.findMany({
    where: { cardId },
    orderBy: { createdAt: "asc" },
    take: LIMITS.page,
  });
};
