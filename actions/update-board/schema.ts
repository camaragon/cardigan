import { KeyPrefix } from "@/lib/card-key";
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
  keyPrefix: KeyPrefix.optional(),
  image: z.string().optional(),
  notice: z.string().trim().max(2000).optional(),
  id: z.string(),
});
