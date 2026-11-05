import { z } from "zod";
import { LIMITS } from "@/lib/domain/limits";

export const CreateCard = z.object({
  title: z
    .string({
      required_error: "Title is required",
      invalid_type_error: "Title is required",
    })
    .trim()
    .min(1, {
      message: "Title is required",
    })
    .max(LIMITS.title, {
      message: `Title must be at most ${LIMITS.title} characters long`,
    }),
  boardId: z.string(),
  listId: z.string(),
});
