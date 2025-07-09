"use server";

import { auth } from "@clerk/nextjs/server";
import { InputType, ReturnType } from "./types";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { CloneCard } from "./schema";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Unauthorized",
    };
  }

  const { id, boardId } = data;
  let card;

  try {
    const cardToClone = await db.card.findUnique({
      where: {
        id,
        list: {
          board: {
            orgId,
          },
        },
      },
    });

    if (!cardToClone) {
      return {
        error: "Card not found",
      };
    }

    const lastCard = await db.card.findFirst({
      where: {
        listId: cardToClone.listId,
      },
      orderBy: {
        order: "desc",
      },
      select: { order: true },
    });

    const newOrder = lastCard ? lastCard.order + 1 : 1;

    card = await db.card.create({
      data: {
        title: `${cardToClone.title} (Clone)`,
        description: cardToClone.description,
        order: newOrder,
        listId: cardToClone.listId,
      },
    });
  } catch {
    return {
      error: "Failed to clone card",
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: card };
};

export const cloneCard = createSafeAction(CloneCard, handler);
