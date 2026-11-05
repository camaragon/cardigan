"use server";

import { InputType, ReturnType } from "./types";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { UnassignLabel } from "./schema";
import { setCardLabel } from "@/lib/domain/cards";
import { errorMessage } from "@/lib/domain/errors";
import { getPersonActor } from "@/lib/domain/person";

const handler = async (data: InputType): Promise<ReturnType> => {
  const actor = await getPersonActor();

  if (!actor) {
    return { error: "Unauthorized" };
  }

  const { cardId, labelId, boardId } = data;
  let cardLabel;

  try {
    cardLabel = await setCardLabel(actor, {
      cardId,
      labelId,
      assigned: false,
    });
  } catch (error) {
    return { error: errorMessage(error, "Failed to unassign label") };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: cardLabel };
};

export const unassignLabel = createSafeAction(UnassignLabel, handler);
