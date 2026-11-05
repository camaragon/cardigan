"use server";

import { InputType, ReturnType } from "./types";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { UpdateCard } from "./schema";
import { updateCard as updateCardInDomain } from "@/lib/domain/cards";
import { errorMessage } from "@/lib/domain/errors";
import { getPersonActor } from "@/lib/domain/person";

const handler = async (data: InputType): Promise<ReturnType> => {
  const actor = await getPersonActor();

  if (!actor) {
    return {
      error: "Unauthorized",
    };
  }

  const { id, boardId, title, description } = data;
  let card;

  try {
    card = await updateCardInDomain(actor, { cardId: id, title, description });
  } catch (error) {
    return {
      error: errorMessage(error, "Failed to update card"),
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: card };
};

export const updateCard = createSafeAction(UpdateCard, handler);
