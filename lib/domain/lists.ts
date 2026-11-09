import { randomUUID } from "node:crypto";
import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { Actor, requirePerson } from "./actor";
import { transaction, writeAudit } from "./audit";
import { DomainError, notFound } from "./errors";
import { lockBoardOrder } from "./ordering";

export const createList = async (actor: Actor, input: { boardId: string; title: string }) => {
  requirePerson(actor);
  return transaction(async (tx) => {
    await lockBoardOrder(tx, input.boardId);
    const board = await tx.board.findUnique({ where: { id: input.boardId, orgId: actor.orgId } });
    if (!board) throw notFound("Board");
    const last = await tx.list.findFirst({ where: { boardId: board.id }, orderBy: { order: "desc" } });
    const list = await tx.list.create({ data: { ...input, order: last ? last.order + 1 : 0 } });
    await writeAudit(tx, actor, { action: ACTION.CREATE, entityType: ENTITY_TYPE.LIST, entityId: list.id, entityTitle: list.title });
    return list;
  });
};

export const updateList = async (actor: Actor, input: { id: string; boardId: string; title: string }) => {
  requirePerson(actor);
  return transaction(async (tx) => {
    const list = await tx.list.update({
      where: { id: input.id, boardId: input.boardId, board: { orgId: actor.orgId } },
      data: { title: input.title },
    });
    await writeAudit(tx, actor, { action: ACTION.UPDATE, entityType: ENTITY_TYPE.LIST, entityId: list.id, entityTitle: list.title });
    return list;
  });
};

export const reorderLists = async (actor: Actor, input: { boardId: string; lists: { id: string; order: number }[] }) => {
  requirePerson(actor);
  return transaction(async (tx) => {
    await lockBoardOrder(tx, input.boardId);
    const board = await tx.board.findUnique({
      where: { id: input.boardId, orgId: actor.orgId },
      include: { lists: { select: { id: true } } },
    });
    if (!board) throw notFound("Board");
    const ids = new Set(input.lists.map((list) => list.id));
    const orders = new Set(input.lists.map((list) => list.order));
    if (ids.size !== input.lists.length || ids.size !== board.lists.length ||
        board.lists.some((list) => !ids.has(list.id)) || orders.size !== ids.size ||
        input.lists.some((list) => !Number.isSafeInteger(list.order) || list.order < 0)) {
      throw new DomainError("invalid", "Submit each list on this board once with distinct nonnegative integer positions");
    }
    const lists = [];
    for (const list of input.lists) {
      lists.push(await tx.list.update({
        where: { id: list.id, boardId: board.id, board: { orgId: actor.orgId } },
        data: { order: list.order },
      }));
    }
    await writeAudit(tx, actor, { action: ACTION.UPDATE, entityType: ENTITY_TYPE.BOARD, entityId: board.id, entityTitle: board.title });
    return lists;
  });
};

export const cloneList = async (actor: Actor, input: { id: string; boardId: string }) => {
  requirePerson(actor);
  return transaction(async (tx) => {
    await lockBoardOrder(tx, input.boardId);
    const source = await tx.list.findUnique({
      where: { id: input.id, boardId: input.boardId, board: { orgId: actor.orgId } },
      include: { cards: { orderBy: [{ order: "asc" }, { id: "asc" }], include: { labels: true } } },
    });
    if (!source) throw notFound("List");
    const last = await tx.list.findFirst({ where: { boardId: source.boardId }, orderBy: { order: "desc" } });
    // Allocate ids alongside each source so label copies never depend on return order.
    const copies = source.cards.map((card, order) => ({ source: card, id: randomUUID(), order }));
    const list = await tx.list.create({
      data: {
        boardId: source.boardId,
        title: `${source.title} - Clone`,
        order: last ? last.order + 1 : 1,
        cards: {
          createMany: {
            data: copies.map(({ source: card, id, order }) => ({
              id, order, title: card.title, description: card.description,
              priority: card.priority, assignee: card.assignee,
              creatorKind: actor.kind, creatorId: actor.id,
              creatorName: actor.name, creatorSurface: actor.surface,
            })),
          },
        },
      },
      include: { cards: true },
    });
    const labels = copies.flatMap(({ source: card, id }) =>
      card.labels.map(({ labelId }) => ({ cardId: id, labelId })),
    );
    if (labels.length) await tx.cardLabel.createMany({ data: labels });
    await writeAudit(tx, actor, {
      action: ACTION.CREATE, entityType: ENTITY_TYPE.LIST,
      entityId: list.id, entityTitle: list.title,
    });
    return list;
  });
};
