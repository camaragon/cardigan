"use server";

import { auth } from "@clerk/nextjs/server";
import { InputType, ReturnType } from "./types";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { CloneList } from "./schema";
import { createAuditLog } from "@/lib/create-audit-log";
import { ACTION, ENTITY_TYPE } from "@prisma/client";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Unauthorized",
    };
  }

  const { id, boardId } = data;
  let list;

  try {
    const listToClone = await db.list.findUnique({
      where: {
        id,
        boardId,
        board: {
          orgId,
        },
      },
      include: {
        cards: {
          include: {
            labels: true,
          },
        },
      },
    });

    if (!listToClone) {
      return {
        error: "List not found",
      };
    }

    const lastList = await db.list.findFirst({
      where: {
        boardId,
      },
      orderBy: {
        order: "desc",
      },
    });

    const newOrder = lastList ? lastList.order + 1 : 1;

    list = await db.list.create({
      data: {
        boardId: listToClone.boardId,
        title: `${listToClone.title} - Clone`,
        order: newOrder,
        cards: {
          createMany: {
            data: listToClone.cards.map((card) => ({
              title: card.title,
              description: card.description,
              order: card.order,
            })),
          },
        },
      },
      include: {
        cards: true,
      },
    });

    // Copy labels from original cards to cloned cards
    // Sort both arrays by order to align by index (createMany preserves insertion order)
    const sortedOriginals = [...listToClone.cards].sort((a, b) => a.order - b.order);
    const sortedClones = [...list.cards].sort((a, b) => a.order - b.order);

    const labelRecords: { cardId: string; labelId: string }[] = [];
    for (let i = 0; i < sortedClones.length; i++) {
      const originalCard = sortedOriginals[i];
      if (originalCard && originalCard.labels.length > 0) {
        for (const cl of originalCard.labels) {
          labelRecords.push({ cardId: sortedClones[i].id, labelId: cl.labelId });
        }
      }
    }

    if (labelRecords.length > 0) {
      await db.cardLabel.createMany({ data: labelRecords });
    }

    await createAuditLog({
      entityTitle: list.title,
      entityId: list.id,
      entityType: ENTITY_TYPE.LIST,
      action: ACTION.CREATE,
    });
  } catch {
    return {
      error: "Failed to clone list",
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: list };
};

export const cloneList = createSafeAction(CloneList, handler);
