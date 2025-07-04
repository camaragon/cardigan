import { z } from "zod";

export const CloneList = z.object({
  id: z.string(),
  boardId: z.string(),
});
