import { z } from "zod";
import { LIMITS } from "@/lib/domain/limits";

export const CreateAgentToken = z.object({
  agentName: z
    .string({
      required_error: "Agent name is required",
      invalid_type_error: "Agent name is required",
    })
    .trim()
    .min(1, { message: "Agent name is required" })
    .max(LIMITS.agentName),
  roleKey: z.string().min(1, { message: "Choose a role" }),
});
