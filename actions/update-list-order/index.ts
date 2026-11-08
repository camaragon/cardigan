"use server";

import { auth } from "@clerk/nextjs/server";
import { InputType, ReturnType } from "./types";
import { transaction } from "@/lib/domain/audit";
import { lockBoardOrder } from "@/lib/domain/ordering";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { UpdateListOrder } from "./schema";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Unauthorized",
    };
  }

  const { boardId, lists } = data;
  let updatedLists;

  try {
    updatedLists = await transaction(async (tx) => {
      await lockBoardOrder(tx, boardId);
      const updated = [];
      for (const list of lists) {
        updated.push(await tx.list.update({
          where: { id: list.id, boardId, board: { orgId } },
          data: { order: list.order },
        }));
      }
      return updated;
    });
  } catch {
    return {
      error: "Failed to reorder",
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: updatedLists };
};

export const updateListOrder = createSafeAction(UpdateListOrder, handler);
