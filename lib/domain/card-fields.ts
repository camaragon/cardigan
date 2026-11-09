import { z } from "zod";

export const CARD_PRIORITIES = ["none", "low", "medium", "high"] as const;
export const ASSIGNEE_MAX = 80;

export const CardFields = z.object({
  priority: z.enum(CARD_PRIORITIES).optional(),
  assignee: z.string().trim().max(ASSIGNEE_MAX).optional(),
  blockedByIds: z.array(z.string().min(1).max(100)).optional(),
});
