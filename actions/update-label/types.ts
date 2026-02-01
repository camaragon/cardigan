import { z } from "zod";
import { Label } from "@prisma/client";
import { ActionState } from "@/lib/create-safe-action";
import { UpdateLabel } from "./schema";

export type InputType = z.infer<typeof UpdateLabel>;
export type ReturnType = ActionState<InputType, Label>;
