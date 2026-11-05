"use server";

import { InputType, ReturnType } from "./types";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { CreateCard } from "./schema";
import { createCard as createCardInDomain } from "@/lib/domain/cards";
import { runAsPerson } from "@/lib/domain/run-as-person";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { boardId, listId, title } = data;
  const result = await runAsPerson("Failed to create card", async (actor) => {
    const { card } = await createCardInDomain(actor, { listId, title });
    return card;
  });
  if (result.data) revalidatePath(`/board/${boardId}`);
  return result;
};

export const createCard = createSafeAction(CreateCard, handler);
