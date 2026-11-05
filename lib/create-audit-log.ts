import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { transaction, writeAudit } from "@/lib/domain/audit";
import { getPersonActor } from "@/lib/domain/person";

interface CreateAuditLogProps {
  entityId: string;
  entityType: ENTITY_TYPE;
  entityTitle: string;
  action: ACTION;
}

/**
 * Audit entry for the board, list and label actions that do not yet go through
 * a domain function. Attributed to the signed-in person on the UI surface and
 * given an event id like every other entry.
 */
export const createAuditLog = async (entry: CreateAuditLogProps) => {
  try {
    const actor = await getPersonActor();
    if (!actor) throw new Error("User not found");
    await transaction((tx) => writeAudit(tx, actor, entry));
  } catch (error) {
    console.log("[AUDIT_LOG_ERROR]", error);
  }
};
