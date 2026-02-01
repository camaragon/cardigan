import { z } from "zod";
import { CardLabel } from "@prisma/client";
import { ActionState } from "@/lib/create-safe-action";
import { UnassignLabel } from "./schema";

export type InputType = z.infer<typeof UnassignLabel>;
export type ReturnType = ActionState<InputType, CardLabel>;
