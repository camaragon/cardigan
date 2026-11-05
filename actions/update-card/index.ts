"use server";

import { InputType, ReturnType } from "./types";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { UpdateCard } from "./schema";
import { updateCard as updateCardInDomain } from "@/lib/domain/cards";
import { runAsPerson } from "@/lib/domain/run-as-person";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { id, boardId, title, description } = data;
  const result = await runAsPerson("Failed to update card", (actor) =>
    updateCardInDomain(actor, { cardId: id, title, description }),
  );
  if (result.data) revalidatePath(`/board/${boardId}`);
  return result;
};

export const updateCard = createSafeAction(UpdateCard, handler);
