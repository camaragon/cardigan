import { z } from "zod";
import { Comment } from "@prisma/client";
import { ActionState } from "@/lib/create-safe-action";
import { AddComment } from "./schema";

export type InputType = z.infer<typeof AddComment>;
export type ReturnType = ActionState<InputType, Comment>;
