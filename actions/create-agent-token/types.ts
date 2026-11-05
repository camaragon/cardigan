import { z } from "zod";
import { ActionState } from "@/lib/create-safe-action";
import { CreateAgentToken } from "./schema";

export type InputType = z.infer<typeof CreateAgentToken>;
/** The secret is returned once, here, and never again. */
export type ReturnType = ActionState<
  InputType,
  { tokenId: string; agentName: string; secret: string }
>;
