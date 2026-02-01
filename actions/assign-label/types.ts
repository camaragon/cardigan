import { z } from "zod";
import { CardLabel } from "@prisma/client";
import { ActionState } from "@/lib/create-safe-action";
import { AssignLabel } from "./schema";

export type InputType = z.infer<typeof AssignLabel>;
export type ReturnType = ActionState<InputType, CardLabel>;
