import { z } from "zod";

export const MoveCard = z.object({
  id: z.string().min(1),
  boardId: z.string().min(1),
  toListId: z.string().min(1),
  position: z.number().int().min(0),
});
