"use server";

import { getPersonActor } from "@/lib/domain/person";
import { InputType, ReturnType } from "./types";
import { deleteLabel as mutate } from "@/lib/domain/deletes";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { DeleteLabel } from "./schema";

const handler = async (data: InputType): Promise<ReturnType> => {
  const actor = await getPersonActor();

  if (!actor) {
    return { error: "Unauthorized" };
  }

  const { id, boardId } = data;
  let label;

  try {
    label = await mutate(actor, { id });
  } catch {
    return { error: "Failed to delete label" };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: label };
};

export const deleteLabel = createSafeAction(DeleteLabel, handler);
