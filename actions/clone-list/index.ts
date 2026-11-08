"use server";

import { auth } from "@clerk/nextjs/server";
import { InputType, ReturnType } from "./types";
import { transaction } from "@/lib/domain/audit";
import { lockBoardOrder } from "@/lib/domain/ordering";
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
    list = await transaction(async (tx) => {
      await lockBoardOrder(tx, boardId);
      const listToClone = await tx.list.findUnique({
        where: {
          id,
          boardId,
          board: {
            orgId,
          },
        },
        include: {
          cards: {
            orderBy: [{ order: "asc" }, { id: "asc" }],
            include: {
              labels: true,
            },
          },
        },
      });

      if (!listToClone) {
        return null;
      }

      const lastList = await tx.list.findFirst({
        where: {
          boardId,
        },
        orderBy: {
          order: "desc",
        },
      });

      const newOrder = lastList ? lastList.order + 1 : 1;

      const created = await tx.list.create({
        data: {
          boardId: listToClone.boardId,
          title: `${listToClone.title} - Clone`,
          order: newOrder,
          cards: {
            createMany: {
              data: listToClone.cards.map((card, order) => ({
                title: card.title,
                description: card.description,
                order,
              })),
            },
          },
        },
        include: {
          cards: true,
        },
      });

      // Copy labels from original cards to cloned cards
      // Clones have unique positions matching the ordered source array.
      const sortedOriginals = listToClone.cards;
      const sortedClones = [...created.cards].sort((a, b) => a.order - b.order);

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
        await tx.cardLabel.createMany({ data: labelRecords });
      }

      return created;
    });

    if (!list) return { error: "List not found" };

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
