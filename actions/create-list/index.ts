"use server";

import { auth } from "@clerk/nextjs/server";
import { InputType, ReturnType } from "./types";
import { transaction } from "@/lib/domain/audit";
import { lockBoardOrder } from "@/lib/domain/ordering";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { CreateList } from "./schema";
import { createAuditLog } from "@/lib/create-audit-log";
import { ACTION, ENTITY_TYPE } from "@prisma/client";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Unauthorized",
    };
  }

  const { boardId, title } = data;
  let list;

  try {
    list = await transaction(async (tx) => {
      await lockBoardOrder(tx, boardId);
      const board = await tx.board.findUnique({
        where: {
          id: boardId,
          orgId,
        },
      });

      if (!board) {
        return null;
      }

      const lastList = await tx.list.findFirst({
        where: {
          boardId,
        },
        orderBy: {
          order: "desc",
        },
        select: {
          order: true,
        },
      });

      const newOrder = lastList ? lastList.order + 1 : 0;

      const created = await tx.list.create({
        data: {
          boardId,
          title,
          order: newOrder,
        },
      });

      return created;
    });

    if (!list) return { error: "Board not found" };

    await createAuditLog({
      entityTitle: list.title,
      entityId: list.id,
      entityType: ENTITY_TYPE.LIST,
      action: ACTION.CREATE,
    });
  } catch {
    return {
      error: "Failed to create list",
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: list };
};

export const createList = createSafeAction(CreateList, handler);
