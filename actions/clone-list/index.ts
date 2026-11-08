"use server";

import { getPersonActor } from "@/lib/domain/person";
import { InputType, ReturnType } from "./types";
import { cloneList as mutate } from "@/lib/domain/lists";
import { errorMessage } from "@/lib/domain/errors";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { CloneList } from "./schema";

const handler = async (data: InputType): Promise<ReturnType> => {
  const actor = await getPersonActor();

  if (!actor) {
    return {
      error: "Unauthorized",
    };
  }

  const { id, boardId } = data;
  let list;

  try {
    list = await mutate(actor, { id, boardId });
  } catch (error) {
    return {
      error: errorMessage(error, "Failed to clone list"),
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: list };
};

export const cloneList = createSafeAction(CloneList, handler);
