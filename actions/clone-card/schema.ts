import { z } from "zod";

export const CloneCard = z.object({
  id: z.string(),
  boardId: z.string(),
});
