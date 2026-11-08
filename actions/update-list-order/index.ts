"use server";

import { getPersonActor } from "@/lib/domain/person";
import { InputType, ReturnType } from "./types";
import { reorderLists as mutate } from "@/lib/domain/lists";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { UpdateListOrder } from "./schema";

const handler = async (data: InputType): Promise<ReturnType> => {
  const actor = await getPersonActor();

  if (!actor) {
    return {
      error: "Unauthorized",
    };
  }

  const { boardId, lists } = data;
  let updatedLists;

  try {
    updatedLists = await mutate(actor, { boardId, lists });
  } catch {
    return {
      error: "Failed to reorder",
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: updatedLists };
};

export const updateListOrder = createSafeAction(UpdateListOrder, handler);
