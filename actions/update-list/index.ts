"use server";

import { getPersonActor } from "@/lib/domain/person";
import { InputType, ReturnType } from "./types";
import { updateList as mutate } from "@/lib/domain/lists";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { UpdateList } from "./schema";

const handler = async (data: InputType): Promise<ReturnType> => {
  const actor = await getPersonActor();

  if (!actor) {
    return {
      error: "Unauthorized",
    };
  }

  const { title, id, boardId } = data;
  let list;

  try {
    list = await mutate(actor, { id, boardId, title });
  } catch {
    return {
      error: "Failed to update list",
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: list };
};

export const updateList = createSafeAction(UpdateList, handler);
