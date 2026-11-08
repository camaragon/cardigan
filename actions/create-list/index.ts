"use server";

import { getPersonActor } from "@/lib/domain/person";
import { InputType, ReturnType } from "./types";
import { createList as mutate } from "@/lib/domain/lists";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { CreateList } from "./schema";

const handler = async (data: InputType): Promise<ReturnType> => {
  const actor = await getPersonActor();

  if (!actor) {
    return {
      error: "Unauthorized",
    };
  }

  const { boardId, title } = data;
  let list;

  try {
    list = await mutate(actor, { boardId, title });
  } catch {
    return {
      error: "Failed to create list",
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: list };
};

export const createList = createSafeAction(CreateList, handler);
