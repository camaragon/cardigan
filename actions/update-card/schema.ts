import { z } from "zod";
import { LIMITS } from "@/lib/domain/limits";

export const UpdateCard = z.object({
  boardId: z.string(),
  description: z.optional(
    z
      .string({
        required_error: "Description is required",
        invalid_type_error: "Description is required",
      })
      .max(LIMITS.description, {
        message: `Description must be at most ${LIMITS.description} characters long`,
      }),
  ),
  title: z.optional(
    z
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
  ),
  id: z.string(),
});
