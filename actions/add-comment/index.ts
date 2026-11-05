"use server";

import { InputType, ReturnType } from "./types";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { AddComment } from "./schema";
import { addComment as addCommentInDomain } from "@/lib/domain/comments";
import { errorMessage } from "@/lib/domain/errors";
import { getPersonActor } from "@/lib/domain/person";

const handler = async (data: InputType): Promise<ReturnType> => {
  const actor = await getPersonActor();

  if (!actor) {
    return {
      error: "Unauthorized",
    };
  }

  const { cardId, boardId, body } = data;
  let comment;

  try {
    ({ comment } = await addCommentInDomain(actor, { cardId, body }));
  } catch (error) {
    return {
      error: errorMessage(error, "Failed to add comment"),
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: comment };
};

export const addComment = createSafeAction(AddComment, handler);
