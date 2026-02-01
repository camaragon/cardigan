"use server";

import { auth } from "@clerk/nextjs/server";
import { InputType, ReturnType } from "./types";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { AssignLabel } from "./schema";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Unauthorized" };
  }

  const { cardId, labelId, boardId } = data;
  let cardLabel;

  try {
    const label = await db.label.findUnique({
      where: { id: labelId, orgId },
    });

    if (!label) {
      return { error: "Label not found" };
    }

    const card = await db.card.findUnique({
      where: {
        id: cardId,
        list: { board: { orgId } },
      },
    });

    if (!card) {
      return { error: "Card not found" };
    }

    cardLabel = await db.cardLabel.create({
      data: { cardId, labelId },
    });
  } catch {
    return { error: "Failed to assign label" };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: cardLabel };
};

export const assignLabel = createSafeAction(AssignLabel, handler);
