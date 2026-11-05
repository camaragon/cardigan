"use server";

import { InputType, ReturnType } from "./types";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { CloneCard } from "./schema";
import { copyCard } from "@/lib/domain/cards";
import { runAsPerson } from "@/lib/domain/run-as-person";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { id, boardId } = data;
  const result = await runAsPerson("Failed to clone card", (actor) =>
    copyCard(actor, id),
  );
  if (result.data) revalidatePath(`/board/${boardId}`);
  return result;
};

export const cloneCard = createSafeAction(CloneCard, handler);
