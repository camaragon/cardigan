import { z } from "zod";

export const MoveCard = z.object({
  id: z.string(),
  boardId: z.string(),
  toListId: z.string(),
  position: z.number().int().min(0),
});
