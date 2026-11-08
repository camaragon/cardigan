"use server";

import { getPersonActor } from "@/lib/domain/person";
import { InputType, ReturnType } from "./types";
import { updateLabel as mutate } from "@/lib/domain/labels";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { UpdateLabel } from "./schema";

const handler = async (data: InputType): Promise<ReturnType> => {
  const actor = await getPersonActor();

  if (!actor) {
    return { error: "Unauthorized" };
  }

  const { id, name, color, boardId } = data;
  let label;

  try {
    label = await mutate(actor, { id, name, color });
  } catch {
    return { error: "Failed to update label" };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: label };
};

export const updateLabel = createSafeAction(UpdateLabel, handler);
