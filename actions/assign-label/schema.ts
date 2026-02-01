import { z } from "zod";

export const AssignLabel = z.object({
  cardId: z.string().min(1),
  labelId: z.string().min(1),
  boardId: z.string().min(1),
});
