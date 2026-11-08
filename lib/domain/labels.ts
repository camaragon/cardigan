import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { Actor, requirePerson } from "./actor";
import { transaction, writeAudit } from "./audit";

export const createLabel = async (actor: Actor, input: { name: string; color: string }) => {
  requirePerson(actor);
  return transaction(async (tx) => {
    const label = await tx.label.create({ data: { ...input, orgId: actor.orgId } });
    await writeAudit(tx, actor, { action: ACTION.CREATE, entityType: ENTITY_TYPE.LABEL, entityId: label.id, entityTitle: label.name });
    return label;
  });
};

export const updateLabel = async (actor: Actor, input: { id: string; name: string; color: string }) => {
  requirePerson(actor);
  return transaction(async (tx) => {
    const label = await tx.label.update({
      where: { id: input.id, orgId: actor.orgId },
      data: { name: input.name, color: input.color },
    });
    await writeAudit(tx, actor, { action: ACTION.UPDATE, entityType: ENTITY_TYPE.LABEL, entityId: label.id, entityTitle: label.name });
    return label;
  });
};
