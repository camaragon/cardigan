import { z } from "zod";

export const UpdateBoard = z.object({
  title: z
    .string({
      required_error: "Title is required",
      invalid_type_error: "Title is required",
    })
    .trim()
    .min(1, {
      message: "Title is required",
    })
    .optional(),
  image: z.string().optional(),
  id: z.string(),
});
