"use server";

import { InputType, ReturnType } from "./types";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { UnassignLabel } from "./schema";
import { setCardLabel } from "@/lib/domain/cards";
import { runAsPerson } from "@/lib/domain/run-as-person";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { cardId, labelId, boardId } = data;
  const result = await runAsPerson("Failed to remove label", (actor) =>
    setCardLabel(actor, { cardId, labelId, assigned: false }),
  );
  if (result.data) revalidatePath(`/board/${boardId}`);
  return result;
};

export const unassignLabel = createSafeAction(UnassignLabel, handler);
