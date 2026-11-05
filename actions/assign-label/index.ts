"use server";

import { InputType, ReturnType } from "./types";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { AssignLabel } from "./schema";
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
      assigned: true,
    });
  } catch (error) {
    return { error: errorMessage(error, "Failed to assign label") };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: cardLabel };
};

export const assignLabel = createSafeAction(AssignLabel, handler);
