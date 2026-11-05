import { ACTION, AuditLog, ENTITY_TYPE, OUTCOME } from "@prisma/client";

export const generateLogMessages = (log: AuditLog) => {
  const { action, entityType, entityTitle } = log;

  if (log.outcome === OUTCOME.FAILED) {
    return `failed a call to ${log.tool ?? "a tool"} (${log.errorType ?? "error"})`;
  }
  if (entityType === ENTITY_TYPE.AGENT_TOKEN) {
    return action === ACTION.REVOKE
      ? `revoked the agent token for ${entityTitle}`
      : `created an agent token for ${entityTitle}`;
  }
  if (entityType === ENTITY_TYPE.FRICTION) {
    return `filed a friction report (${entityTitle})`;
  }

  switch (action) {
    case ACTION.CREATE:
      return `created ${entityType.toLowerCase()} "${entityTitle}"`;
    case ACTION.UPDATE:
      return `updated ${entityType.toLowerCase()} "${entityTitle}"`;
    case ACTION.DELETE:
      return `deleted ${entityType.toLowerCase()} "${entityTitle}"`;
    case ACTION.MOVE:
      return log.fromListId === log.toListId
        ? `reordered card "${entityTitle}"`
        : `moved card "${entityTitle}"`;
    case ACTION.COMMENT:
      return `commented on card "${entityTitle}"`;
    default:
      return `unknown action ${entityType.toLowerCase()} "${entityTitle}"`;
  }
};
