import { z } from "zod";
import { ActionState } from "@/lib/create-safe-action";
import { RevokeAgentToken } from "./schema";

export type InputType = z.infer<typeof RevokeAgentToken>;
export type ReturnType = ActionState<InputType, { tokenId: string }>;
