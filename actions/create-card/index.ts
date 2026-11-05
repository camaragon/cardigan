"use server";

import { InputType, ReturnType } from "./types";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { CreateCard } from "./schema";
import { createCard as createCardInDomain } from "@/lib/domain/cards";
import { errorMessage } from "@/lib/domain/errors";
import { getPersonActor } from "@/lib/domain/person";

const handler = async (data: InputType): Promise<ReturnType> => {
  const actor = await getPersonActor();

  if (!actor) {
    return {
      error: "Unauthorized",
    };
  }

  const { boardId, listId, title } = data;
  let card;

  try {
    ({ card } = await createCardInDomain(actor, { listId, title }));
  } catch (error) {
    return {
      error: errorMessage(error, "Failed to create card"),
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: card };
};

export const createCard = createSafeAction(CreateCard, handler);
