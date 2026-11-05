"use server";

import { InputType, ReturnType } from "./types";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { AddComment } from "./schema";
import { addComment as addCommentInDomain } from "@/lib/domain/comments";
import { runAsPerson } from "@/lib/domain/run-as-person";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { cardId, boardId, body } = data;
  const result = await runAsPerson("Failed to add comment", async (actor) => {
    const { comment } = await addCommentInDomain(actor, { cardId, body });
    return comment;
  });
  if (result.data) revalidatePath(`/board/${boardId}`);
  return result;
};

export const addComment = createSafeAction(AddComment, handler);
