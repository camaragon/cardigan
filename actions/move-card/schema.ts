import { z } from "zod";

export const MoveCard = z.object({
  version: z.number().int().min(1).optional(),
  id: z.string(),
  boardId: z.string(),
  toListId: z.string(),
  position: z.number().int().min(0),
});
