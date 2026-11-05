import { z } from "zod";
import { LIMITS } from "@/lib/domain/limits";

export const AddComment = z.object({
  cardId: z.string().min(1),
  boardId: z.string().min(1),
  body: z
    .string({
      required_error: "Comment is required",
      invalid_type_error: "Comment is required",
    })
    .trim()
    .min(1, { message: "Comment is required" })
    .max(LIMITS.comment),
});
