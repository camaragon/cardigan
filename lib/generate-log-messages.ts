import { ACTION, AuditLog } from "@prisma/client";

export const generateLogMessages = (log: AuditLog) => {
  const { action, entityType, entityTitle } = log;

  switch (action) {
    case ACTION.CREATE:
      return `created ${entityType.toLowerCase()} "${entityTitle}"`;
    case ACTION.UPDATE:
      return `updated ${entityType.toLowerCase()} "${entityTitle}"`;
    case ACTION.DELETE:
      return `deleted ${entityType.toLowerCase()} "${entityTitle}"`;
    default:
      return `unknown action ${entityType.toLowerCase()} "${entityTitle}"`;
  }
};
