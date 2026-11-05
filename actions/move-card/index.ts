"use server";

import { InputType, ReturnType } from "./types";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { MoveCard } from "./schema";
import { moveCard as moveCardInDomain } from "@/lib/domain/cards";
import { errorMessage } from "@/lib/domain/errors";
import { getPersonActor } from "@/lib/domain/person";

/** One drag is one audited single-card move (PRD C-6). */
const handler = async (data: InputType): Promise<ReturnType> => {
  const actor = await getPersonActor();

  if (!actor) {
    return {
      error: "Unauthorized",
    };
  }

  const { id, boardId, toListId, position } = data;
  let card;

  try {
    card = await moveCardInDomain(actor, { cardId: id, toListId, position });
  } catch (error) {
    return {
      error: errorMessage(error, "Failed to move card"),
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: card };
};

export const moveCard = createSafeAction(MoveCard, handler);
