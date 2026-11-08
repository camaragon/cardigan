import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { Actor, requirePerson } from "./actor";
import { transaction, writeAudit } from "./audit";

export const deleteCard = async (actor: Actor, input: { id: string }) => {
  requirePerson(actor);
  const { id } = input;
  return transaction(async (tx) => {
    const card = await tx.card.delete({
      where: {
        id,
        list: {
          board: {
            orgId: actor.orgId,
          },
        },
      },
    });
    await writeAudit(tx, actor, { action: ACTION.DELETE, entityType: ENTITY_TYPE.CARD, entityId: card.id, entityTitle: card.title });
    return card;
  });
};

export const deleteList = async (actor: Actor, input: { id: string; boardId: string }) => {
  requirePerson(actor);
  const { id, boardId } = input;
  return transaction(async (tx) => {
    const list = await tx.list.delete({
      where: {
        id,
        boardId,
        board: {
          orgId: actor.orgId,
        },
      },
    });
    await writeAudit(tx, actor, { action: ACTION.DELETE, entityType: ENTITY_TYPE.LIST, entityId: list.id, entityTitle: list.title });
    return list;
  });
};

export const deleteBoard = async (actor: Actor, input: { id: string }) => {
  requirePerson(actor);
  const { id } = input;
  return transaction(async (tx) => {
    const board = await tx.board.delete({
      where: {
        id,
        orgId: actor.orgId,
      },
    });
    await writeAudit(tx, actor, { action: ACTION.DELETE, entityType: ENTITY_TYPE.BOARD, entityId: board.id, entityTitle: board.title });
    return board;
  });
};

export const deleteLabel = async (actor: Actor, input: { id: string }) => {
  requirePerson(actor);
  const { id } = input;
  return transaction(async (tx) => {
    const label = await tx.label.delete({
      where: { id, orgId: actor.orgId },
    });
    await writeAudit(tx, actor, { action: ACTION.DELETE, entityType: ENTITY_TYPE.LABEL, entityId: label.id, entityTitle: label.name });
    return label;
  });
};
