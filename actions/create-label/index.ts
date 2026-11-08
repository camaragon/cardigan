"use server";

import { getPersonActor } from "@/lib/domain/person";
import { InputType, ReturnType } from "./types";
import { createLabel as mutate } from "@/lib/domain/labels";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { CreateLabel } from "./schema";

const handler = async (data: InputType): Promise<ReturnType> => {
  const actor = await getPersonActor();

  if (!actor) {
    return { error: "Unauthorized" };
  }

  const { name, color, boardId } = data;
  let label;

  try {
    label = await mutate(actor, { name, color });
  } catch {
    return { error: "Failed to create label" };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: label };
};

export const createLabel = createSafeAction(CreateLabel, handler);
