import { ACTION, ENTITY_TYPE, OUTCOME, Prisma } from "@prisma/client";
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
import { CardOperation, checkCardOperation } from "./rules";
import { LIMITS, checkText } from "./limits";

const cardScope = (actor: Actor) => ({
  list: { board: { orgId: actor.orgId } },
});

const cardWithContext = {
  list: { include: { board: true } },
  labels: { include: { label: true } },
} satisfies Prisma.CardInclude;

export type CardWithContext = Prisma.CardGetPayload<{
  include: typeof cardWithContext;
}>;

export const roleNames = async (tx: Tx | typeof db, orgId: string) => {
  const roles = await tx.agentRole.findMany({ where: { orgId } });
  return Object.fromEntries(roles.map((r) => [r.key, r.name]));
};

const loadCard = async (tx: Tx | typeof db, actor: Actor, cardId: string) => {
  const card = await tx.card.findFirst({
    where: { id: cardId, ...cardScope(actor) },
    include: cardWithContext,
  });
  if (!card) throw notFound("Card");
  return card;
};

const loadList = async (tx: Tx | typeof db, actor: Actor, listId: string) => {
  const list = await tx.list.findFirst({
    where: { id: listId, board: { orgId: actor.orgId } },
    include: { board: true },
  });
  if (!list) throw notFound("List");
  return list;
};

/** Refuses an operation the actor's role or the list rules do not allow. */
export const enforce = async (
  tx: Tx | typeof db,
  actor: Actor,
  op: CardOperation,
  boardTemplate: string,
) => {
  const denial = checkCardOperation(
    actor,
    op,
    boardTemplate,
    await roleNames(tx, actor.orgId),
  );
  if (!denial) return;
  const where =
    op.kind === "move"
      ? `move cards from ${op.from.title} to ${op.to.title}`
      : `${op.kind} cards in ${op.list.title}`;
  throw denied(`Not allowed to ${where}`, denial);
};

/** Compact card shape for list and search results (PRD S-3). */
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
export type CompactCard = ReturnType<typeof compactCard>;

const lastActor = async (orgId: string, cardId: string) => {
  const entry = await db.auditLog.findFirst({
    where: { orgId, entityId: cardId, outcome: OUTCOME.OK },
    orderBy: { createdAt: "desc" },
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
    `Card changed since version you read; it is now at version ${card.version}`,
    {
      current: compactCard(card),
      lastActor: await lastActor(actor.orgId, cardId),
    },
  );
};

/** Retries once when a concurrent call took the same external key first. */
const withKeyRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (isUniqueViolation(error)) return fn();
    throw error;
  }
};

const nextOrder = async (tx: Tx, listId: string) => {
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
}

/**
 * Creates one card. With an external key, a retry with the same payload
 * returns the existing card without a second create entry (PRD C-3).
 */
export const createCard = async (actor: Actor, input: CreateCardInput) => {
  checkText("title", input.title, LIMITS.title);
  if (input.description) {
    checkText("description", input.description, LIMITS.description);
  }

  return withKeyRetry(() =>
    transaction(async (tx) => {
      const list = await loadList(tx, actor, input.listId);
      const scope = keyScope(actor);
      const payloadHash = hashPayload({
        listId: input.listId,
        title: input.title,
        description: input.description ?? null,
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
          const card = await loadCard(tx, actor, existing.entityId);
          return { card, created: false };
        }
      }

      await enforce(tx, actor, { kind: "create", list }, list.board.template);

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
        },
        include: cardWithContext,
      });

      if (input.externalKey) {
        await saveExternalKey(tx, {
          orgId: actor.orgId,
          scope,
          key: input.externalKey,
          payloadHash,
          entityType: ENTITY_TYPE.CARD,
          entityId: card.id,
          tokenId: actor.tokenId,
        });
      }

      await writeAudit(tx, actor, {
        action: ACTION.CREATE,
        entityType: ENTITY_TYPE.CARD,
        entityId: card.id,
        entityTitle: card.title,
        cardId: card.id,
        toListId: list.id,
      });
      return { card, created: true };
    }),
  );
};

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
  if (items.length > LIMITS.batch) {
    throw new DomainError(
      "invalid",
      `A batch holds at most ${LIMITS.batch} cards`,
    );
  }
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

export interface UpdateCardInput {
  cardId: string;
  title?: string;
  description?: string;
  /** When given, the update is refused unless the card is at this version. */
  expectedVersion?: number;
}

export const updateCard = async (actor: Actor, input: UpdateCardInput) => {
  if (input.title !== undefined) checkText("title", input.title, LIMITS.title);
  if (input.description) {
    checkText("description", input.description, LIMITS.description);
  }

  const result = await transaction(async (tx) => {
    const card = await loadCard(tx, actor, input.cardId);
    await enforce(
      tx,
      actor,
      { kind: "edit", list: card.list },
      card.list.board.template,
    );

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
    const card = await loadCard(tx, actor, input.cardId);
    const target = await loadList(tx, actor, input.toListId);
    if (target.boardId !== card.list.boardId) {
      throw new DomainError("invalid", "Cards move only within their board");
    }

    const sameList = target.id === card.listId;
    const op: CardOperation = sameList
      ? { kind: "reorder", list: card.list }
      : { kind: "move", from: card.list, to: target };
    await enforce(tx, actor, op, card.list.board.template);

    const version = input.expectedVersion ?? card.version;
    if (version !== card.version) return null;

    const siblings = await tx.card.findMany({
      where: { listId: target.id, NOT: { id: card.id } },
      orderBy: { order: "asc" },
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
        orderBy: { order: "asc" },
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

/** UI copy: a create in the same list under the same rules. */
export const copyCard = async (actor: Actor, cardId: string) => {
  const source = await loadCard(db, actor, cardId);
  const { card } = await createCard(actor, {
    listId: source.listId,
    title: `${source.title} (Clone)`,
    description: source.description ?? undefined,
  });
  if (source.labels.length > 0) {
    await db.cardLabel.createMany({
      data: source.labels.map((l) => ({ cardId: card.id, labelId: l.labelId })),
    });
  }
  return card;
};

/** Assigning or removing a label is an edit under the list's edit rule. */
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
    await enforce(
      tx,
      actor,
      { kind: "edit", list: card.list },
      card.list.board.template,
    );

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
      return existing ?? { cardId: card.id, labelId: label.id };
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

/** Card read used by the UI read route and the get_card tool. */
export const getCardForUi = (actor: Actor, cardId: string) =>
  loadCard(db, actor, cardId);

/**
 * Everything about one card in one call (PRD S-3): description, labels,
 * comments, provenance and a paged slice of activity.
 */
export const getCard = async (
  actor: Actor,
  cardId: string,
  options: { activityLimit?: number; activityBefore?: number } = {},
) => {
  const card = await loadCard(db, actor, cardId);
  const [comments, key, activity] = await Promise.all([
    db.comment.findMany({
      where: { cardId: card.id },
      orderBy: { createdAt: "asc" },
      take: LIMITS.page,
    }),
    db.externalKey.findFirst({
      where: { orgId: actor.orgId, entityId: card.id, entityType: "CARD" },
    }),
    getCardActivity(actor, card.id, {
      limit: options.activityLimit,
      before: options.activityBefore,
    }),
  ]);

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
    comments: comments.map((c) => ({
      id: c.id,
      kind: c.kind,
      body: c.body,
      duplicateOfCardId: c.duplicateOfCardId,
      actor: { kind: c.actorKind, name: c.actorName, surface: c.surface },
      createdAt: c.createdAt.toISOString(),
    })),
    activity,
  };
};

/** Successful entries about one card, newest first, paged by event id. */
export const getCardActivity = async (
  actor: Actor,
  cardId: string,
  options: { limit?: number; before?: number } = {},
) => {
  const limit = Math.min(options.limit ?? 10, LIMITS.page);
  const entries = await db.auditLog.findMany({
    where: {
      orgId: actor.orgId,
      outcome: OUTCOME.OK,
      OR: [{ entityId: cardId }, { cardId }],
      ...(options.before ? { eventId: { lt: options.before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return entries;
};

const compactInclude = {
  list: { include: { board: true } },
  labels: { include: { label: true } },
} satisfies Prisma.CardInclude;

/** Compact, paged card list for one board or list, in board order. */
export const listCards = async (
  actor: Actor,
  options: { boardId?: string; listId?: string; limit?: number; cursor?: string },
) => {
  const limit = Math.min(options.limit ?? LIMITS.page, LIMITS.page);
  const offset = options.cursor ? Number.parseInt(options.cursor, 10) || 0 : 0;
  const cards = await db.card.findMany({
    where: {
      ...cardScope(actor),
      ...(options.listId ? { listId: options.listId } : {}),
      ...(options.boardId ? { list: { boardId: options.boardId, board: { orgId: actor.orgId } } } : {}),
    },
    include: compactInclude,
    orderBy: [{ list: { order: "asc" } }, { order: "asc" }],
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
  checkText("query", options.query, LIMITS.query);
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
    include: compactInclude,
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
  return { cards: cards.map(compactCard) };
};
