import { z } from "zod";
import { List } from "@prisma/client";
import { ActionState } from "@/lib/create-safe-action";
import { CloneList } from "./schema";

export type InputType = z.infer<typeof CloneList>;
export type ReturnType = ActionState<InputType, List>;
