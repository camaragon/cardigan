import { z } from "zod";
import { LIMITS } from "@/lib/domain/limits";

export const AddComment = z.object({
  body: z
    .string({
      required_error: "Comment is required",
      invalid_type_error: "Comment is required",
    })
    .trim()
    .min(1, {
      message: "Comment is required",
    })
    .max(LIMITS.comment, {
      message: `Comment must be at most ${LIMITS.comment} characters long`,
    }),
  boardId: z.string(),
  cardId: z.string(),
});
