import { z } from "zod";

export const CreateLabel = z.object({
  name: z
    .string({
      required_error: "Name is required",
      invalid_type_error: "Name is required",
    })
    .min(1, { message: "Name is required" })
    .max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color"),
  boardId: z.string(),
});
