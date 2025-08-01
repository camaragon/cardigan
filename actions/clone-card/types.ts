import { z } from "zod";
import { Card } from "@prisma/client";
import { ActionState } from "@/lib/create-safe-action";
import { CloneCard } from "./schema";

export type InputType = z.infer<typeof CloneCard>;
export type ReturnType = ActionState<InputType, Card>;
