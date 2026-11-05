import { z } from "zod";

export const CreateBoard = z.object({
  title: z
    .string({
      required_error: "Title is required",
      invalid_type_error: "Title is required",
    })
    .trim()
    .min(1, {
      message: "Title is required",
    }),
  template: z.enum(["plain", "product"]).optional(),
  image: z.string({
    required_error: "Image is required",
    invalid_type_error: "Image is required",
  }),
});
