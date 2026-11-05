import { z } from "zod";

export const CreateList = z.object({
  title: z
    .string({
      required_error: "Title is required",
      invalid_type_error: "Title is required",
    })
    .trim()
    .min(1, {
      message: "Title is required",
    }),
  boardId: z.string(),
});
