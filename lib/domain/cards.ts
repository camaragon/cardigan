import { ACTION, ENTITY_TYPE, OUTCOME, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { Actor, Capability, hasCapability, keyScope } from "./actor";
import { transaction, Tx, writeAudit } from "./audit";
import { denied, DomainError, notFound } from "./errors";
import { keyedWrite } from "./keys";
import { LIMITS } from "./limits";
import { lockBoardOrder } from "./ordering";

const cardWithContext = {
  list: true,
  labels: { include: { label: true } },
} satisfies Prisma.CardInclude;

export type CardWithContext = Prisma.CardGetPayload<{
  include: typeof cardWithContext;
}>;

/** A card in the actor's workspace, or not found. */
export const loadCard = async (
  tx: Tx | typeof db,
  actor: Actor,
  cardId: string,
) => {
  const card = await tx.card.findFirst({
    where: { id: cardId, list: { board: { orgId: actor.orgId } } },
    include: cardWithContext,
  });
  if (!card) throw notFound("Card");
  return card;
};

const loadList = async (tx: Tx | typeof db, actor: Actor, listId: string) => {
  const list = await tx.list.findFirst({
    where: { id: listId, board: { orgId: actor.orgId } },
  });
  if (!list) throw notFound("List");
  return list;
};

/** Refuses an action the agent's role does not include (ADR 0004). */
export const requireCapability = (actor: Actor, capability: Capability) => {
  if (hasCapability(actor, capability)) return;
  throw denied(`Your role may not ${capability} cards`, {
    rule: "role.capability",
    allowed: [`agent roles with the "${capability}" capability`, "people"],
    alternative: "Comment on the card to ask someone who may do this.",
  });
};

/** Compact card shape for agent results (PRD S-3). */
export const compactCard = (card: CardWithContext) => ({
  id: card.id,
  title: card.title,
  listId: card.listId,
  list: card.list.title,
  boardId: card.list.boardId,
  labels: card.labels.map((l) => l.label.name),
  version: card.version,
  updatedAt: card.updatedAt.toISOString(),
});

const lastActor = async (orgId: string, cardId: string) => {
  const entry = await db.auditLog.findFirst({
    where: {
      orgId, entityId: cardId, entityType: ENTITY_TYPE.CARD, outcome: OUTCOME.OK,
      OR: [
        { action: { in: [ACTION.CREATE, ACTION.UPDATE] } },
        { action: ACTION.MOVE, NOT: { fromListId: { equals: db.auditLog.fields.toListId } } },
      ],
    },
    orderBy: [
      { eventId: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
      { id: "desc" },
    ],
  });
  return entry
    ? {
        kind: entry.actorKind,
        name: entry.userName,
        surface: entry.surface,
        tokenId: entry.tokenId,
        at: entry.createdAt.toISOString(),
      }
    : null;
};

/** A stale version error carries the current card and who changed it last. */
const staleVersion = async (actor: Actor, cardId: string) => {
  const card = await loadCard(db, actor, cardId);
  return new DomainError(
    "stale_version",
    `Card changed since the version you read; it is now at version ${card.version}`,
    {
      current: compactCard(card),
      lastActor: await lastActor(actor.orgId, cardId),
    },
  );
};

export const nextOrder = async (tx: Tx, listId: string) => {
  const list = await tx.list.findUniqueOrThrow({ where: { id: listId } });
  await lockBoardOrder(tx, list.boardId);
  const last = await tx.card.findFirst({
    where: { listId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return last ? last.order + 1 : 1;
};

export interface CreateCardInput {
  listId: string;
  title: string;
  description?: string;
  externalKey?: string;
  /** Labels to copy onto the new card; used by the UI copy. */
  labelIds?: string[];
}

/**
 * Creates one card. With an external key, a retry with the same payload
 * returns the existing card without a second create entry (PRD C-3).
 */
export const createCard = async (actor: Actor, input: CreateCardInput) => {
  const { result, created } = await keyedWrite({
    orgId: actor.orgId,
    scope: keyScope(actor),
    key: input.externalKey,
    payload: {
      listId: input.listId,
      title: input.title,
      description: input.description ?? null,
    },
    entityType: ENTITY_TYPE.CARD,
    tokenId: actor.tokenId,
    replay: (tx, cardId) => loadCard(tx, actor, cardId),
    write: async (tx) => {
      const list = await loadList(tx, actor, input.listId);
      requireCapability(actor, "create");

      const card = await tx.card.create({
        data: {
          title: input.title,
          description: input.description || null,
          listId: list.id,
          order: await nextOrder(tx, list.id),
          creatorKind: actor.kind,
          creatorId: actor.id,
          creatorName: actor.name,
          creatorSurface: actor.surface,
          labels: {
            createMany: {
              data: (input.labelIds ?? []).map((labelId) => ({ labelId })),
            },
          },
        },
        include: cardWithContext,
      });

      await writeAudit(tx, actor, {
        action: ACTION.CREATE,
        entityType: ENTITY_TYPE.CARD,
        entityId: card.id,
        entityTitle: card.title,
        cardId: card.id,
        toListId: list.id,
      });
      return { entityId: card.id, result: card };
    },
  });
  return { card: result, created };
};

export interface UpdateCardInput {
  cardId: string;
  title?: string;
  description?: string;
  /** When given, the update is refused unless the card is at this version. */
  expectedVersion?: number;
}

export const updateCard = async (actor: Actor, input: UpdateCardInput) => {
  const result = await transaction(async (tx) => {
    const card = await loadCard(tx, actor, input.cardId);
    requireCapability(actor, "update");

    const version = input.expectedVersion ?? card.version;
    const data: Prisma.CardUpdateManyMutationInput = {
      version: { increment: 1 },
    };
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) {
      data.description = input.description || null;
    }
    const { count } = await tx.card.updateMany({
      where: { id: card.id, version },
      data,
    });
    if (count === 0) return null;

    const updated = await loadCard(tx, actor, card.id);
    await writeAudit(tx, actor, {
      action: ACTION.UPDATE,
      entityType: ENTITY_TYPE.CARD,
      entityId: card.id,
      entityTitle: updated.title,
      cardId: card.id,
    });
    return updated;
  });

  if (!result) throw await staleVersion(actor, input.cardId);
  return result;
};

const renumber = async (tx: Tx, ids: string[], current: Map<string, number>) => {
  for (const [index, id] of ids.entries()) {
    if (current.get(id) !== index) {
      await tx.card.update({ where: { id }, data: { order: index } });
    }
  }
};

export interface MoveCardInput {
  cardId: string;
  toListId: string;
  /** Zero-based index in the target list; defaults to the end. */
  position?: number;
  expectedVersion?: number;
}

/**
 * The single-card move every UI drag, UI reorder and agent move goes through
 * (PRD C-6). Writes one entry with the card, source list, target list and
 * position. A move to another list bumps the version; a reorder does not.
 */
export const moveCard = async (actor: Actor, input: MoveCardInput) => {
  const result = await transaction(async (tx) => {
    const target = await loadList(tx, actor, input.toListId);
    await lockBoardOrder(tx, target.boardId);
    const card = await loadCard(tx, actor, input.cardId);
    if (target.boardId !== card.list.boardId) {
      throw new DomainError("invalid", "Cards move only within their board");
    }
    requireCapability(actor, "move");

    const version = input.expectedVersion ?? card.version;
    if (version !== card.version) return null;

    const sameList = target.id === card.listId;
    const siblings = await tx.card.findMany({
      where: { listId: target.id, NOT: { id: card.id } },
      orderBy: [{ order: "asc" }, { id: "asc" }],
      select: { id: true, order: true },
    });
    const position = Math.max(
      0,
      Math.min(input.position ?? siblings.length, siblings.length),
    );

    if (!sameList) {
      const { count } = await tx.card.updateMany({
        where: { id: card.id, version },
        data: { listId: target.id, version: { increment: 1 } },
      });
      if (count === 0) return null;
    }

    const ids = siblings.map((s) => s.id);
    ids.splice(position, 0, card.id);
    const current = new Map(siblings.map((s) => [s.id, s.order]));
    if (sameList) current.set(card.id, card.order);
    await renumber(tx, ids, current);

    if (!sameList) {
      const remaining = await tx.card.findMany({
        where: { listId: card.listId },
        orderBy: [{ order: "asc" }, { id: "asc" }],
        select: { id: true, order: true },
      });
      await renumber(
        tx,
        remaining.map((r) => r.id),
        new Map(remaining.map((r) => [r.id, r.order])),
      );
    }

    const moved = await loadCard(tx, actor, card.id);
    await writeAudit(tx, actor, {
      action: ACTION.MOVE,
      entityType: ENTITY_TYPE.CARD,
      entityId: card.id,
      entityTitle: moved.title,
      cardId: card.id,
      fromListId: card.listId,
      toListId: target.id,
      position,
    });
    return moved;
  });

  if (!result) throw await staleVersion(actor, input.cardId);
  return result;
};

/** UI copy: one create, with the labels, in the same list. */
export const copyCard = async (actor: Actor, cardId: string) => {
  const source = await loadCard(db, actor, cardId);
  const { card } = await createCard(actor, {
    listId: source.listId,
    title: `${source.title} (Clone)`,
    description: source.description ?? undefined,
    labelIds: source.labels.map((l) => l.labelId),
  });
  return card;
};

/** Assigning or removing a label is an edit to the card. */
export const setCardLabel = async (
  actor: Actor,
  input: { cardId: string; labelId: string; assigned: boolean },
) =>
  transaction(async (tx) => {
    const card = await loadCard(tx, actor, input.cardId);
    const label = await tx.label.findFirst({
      where: { id: input.labelId, orgId: actor.orgId },
    });
    if (!label) throw notFound("Label");
    requireCapability(actor, "update");

    const where = {
      cardId_labelId: { cardId: card.id, labelId: label.id },
    };
    const existing = await tx.cardLabel.findUnique({ where });
    if (input.assigned && !existing) {
      await tx.cardLabel.create({
        data: { cardId: card.id, labelId: label.id },
      });
    } else if (!input.assigned && existing) {
      await tx.cardLabel.delete({ where });
    } else {
      return { cardId: card.id, labelId: label.id };
    }

    await tx.card.update({
      where: { id: card.id },
      data: { version: { increment: 1 } },
    });
    await writeAudit(tx, actor, {
      action: ACTION.UPDATE,
      entityType: ENTITY_TYPE.CARD,
      entityId: card.id,
      entityTitle: card.title,
      cardId: card.id,
    });
    return { cardId: card.id, labelId: label.id };
  });

export type CompactCard = ReturnType<typeof compactCard>;

export type BatchItemResult =
  | { ok: true; created: boolean; card: CompactCard }
  | { ok: false; error: { type: string; message: string } };

/**
 * Creates several cards, one transaction each, and returns one result per item
 * in input order; a failed item does not stop the others (PRD S-4).
 */
export const createCards = async (
  actor: Actor,
  items: CreateCardInput[],
): Promise<BatchItemResult[]> => {
  const results: BatchItemResult[] = [];
  for (const item of items) {
    try {
      const { card, created } = await createCard(actor, item);
      results.push({ ok: true, created, card: compactCard(card) });
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      results.push({
        ok: false,
        error: { type: error.type, message: error.message },
      });
    }
  }
  return results;
};

/** Successful entries about one card, newest first, paged by event id. */
const getCardActivity = async (
  actor: Actor,
  cardId: string,
  options: { limit?: number; before?: number } = {},
) =>
  db.auditLog.findMany({
    where: {
      orgId: actor.orgId,
      outcome: OUTCOME.OK,
      OR: [{ entityId: cardId }, { cardId }],
      eventId: options.before ? { lt: options.before } : { not: null },
    },
    orderBy: { eventId: "desc" },
    take: Math.min(options.limit ?? 10, LIMITS.page),
  });

/**
 * Everything about one card in one call (PRD S-3): description, labels,
 * comments, provenance and a paged slice of activity.
 */
export const getCard = async (
  actor: Actor,
  cardId: string,
  options: { activityLimit?: number; activityBefore?: number; commentCursor?: string } = {},
) => {
  const card = await loadCard(db, actor, cardId);
  let after: { createdAt: Date; id: string } | undefined;
  if (options.commentCursor !== undefined) {
    try {
      const [at, id] = JSON.parse(Buffer.from(options.commentCursor, "base64url").toString());
      if (typeof at !== "string" || typeof id !== "string" || !id ||
          !Number.isFinite(Date.parse(at))) throw new Error();
      after = { createdAt: new Date(at), id };
    } catch {
      throw new DomainError("invalid", "commentCursor must be a value from commentNextCursor");
    }
  }
  const [comments, key, activity] = await Promise.all([
    db.comment.findMany({
      where: {
        cardId: card.id,
        ...(after ? { OR: [
          { createdAt: { gt: after.createdAt } },
          { createdAt: after.createdAt, id: { gt: after.id } },
        ] } : {}),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: LIMITS.page + 1,
    }),
    db.externalKey.findFirst({
      where: { orgId: actor.orgId, entityId: card.id, entityType: "CARD" },
    }),
    getCardActivity(actor, card.id, {
      limit: options.activityLimit,
      before: options.activityBefore,
    }),
  ]);
  const commentPage = comments.slice(0, LIMITS.page);
  const lastComment = commentPage.at(-1);
  const commentHasMore = comments.length > LIMITS.page;

  return {
    ...compactCard(card),
    description: card.description,
    createdAt: card.createdAt.toISOString(),
    provenance: {
      creatorKind: card.creatorKind,
      creatorName: card.creatorName,
      surface: card.creatorSurface,
      externalKey: key?.key ?? null,
    },
    comments: commentPage.map((c) => ({
      id: c.id,
      kind: c.kind,
      body: c.body,
      duplicateOfCardId: c.duplicateOfCardId,
      actor: { kind: c.actorKind, name: c.actorName, surface: c.surface },
      createdAt: c.createdAt.toISOString(),
    })),
    commentHasMore,
    commentNextCursor: commentHasMore && lastComment
      ? Buffer.from(JSON.stringify([lastComment.createdAt.toISOString(), lastComment.id])).toString("base64url")
      : null,
    activity,
  };
};

/** Compact, paged card list for one board or list, in board order. */
export const listCards = async (
  actor: Actor,
  options: { boardId?: string; listId?: string; limit?: number; cursor?: string },
) => {
  const limit = Math.min(options.limit ?? LIMITS.page, LIMITS.page);
  const offset = options.cursor ? Number(options.cursor) : 0;
  if (!Number.isInteger(offset) || offset < 0) {
    throw new DomainError("invalid", "cursor must be a value from nextCursor");
  }
  const cards = await db.card.findMany({
    where: {
      list: {
        board: { orgId: actor.orgId },
        ...(options.boardId ? { boardId: options.boardId } : {}),
      },
      ...(options.listId ? { listId: options.listId } : {}),
    },
    include: cardWithContext,
    orderBy: [{ list: { order: "asc" } }, { listId: "asc" }, { order: "asc" }, { id: "asc" }],
    skip: offset,
    take: limit + 1,
  });
  return {
    cards: cards.slice(0, limit).map(compactCard),
    nextCursor: cards.length > limit ? String(offset + limit) : null,
  };
};

/** Searches card titles, descriptions and comments in the actor's workspace. */
export const searchCards = async (
  actor: Actor,
  options: { query: string; boardId?: string; limit?: number },
) => {
  const limit = Math.min(options.limit ?? LIMITS.page, LIMITS.page);
  const contains = { contains: options.query, mode: "insensitive" as const };
  const cards = await db.card.findMany({
    where: {
      list: {
        board: { orgId: actor.orgId },
        ...(options.boardId ? { boardId: options.boardId } : {}),
      },
      OR: [
        { title: contains },
        { description: contains },
        { comments: { some: { body: contains } } },
      ],
    },
    include: cardWithContext,
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
  return { cards: cards.map(compactCard) };
};
