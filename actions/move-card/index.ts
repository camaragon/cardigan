"use server";

import { InputType, ReturnType } from "./types";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { MoveCard } from "./schema";
import { moveCard as moveCardInDomain } from "@/lib/domain/cards";
import { runAsPerson } from "@/lib/domain/run-as-person";

/** One drag is one audited single-card move (PRD C-6). */
const handler = async (data: InputType): Promise<ReturnType> => {
  const { id, boardId, toListId, position } = data;
  const result = await runAsPerson("Failed to move card", (actor) =>
    moveCardInDomain(actor, { cardId: id, toListId, position }),
  );
  if (result.data) revalidatePath(`/board/${boardId}`);
  return result;
};

export const moveCard = createSafeAction(MoveCard, handler);
