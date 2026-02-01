"use server";

import { auth } from "@clerk/nextjs/server";
import { InputType, ReturnType } from "./types";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { DeleteLabel } from "./schema";
import { createAuditLog } from "@/lib/create-audit-log";
import { ACTION, ENTITY_TYPE } from "@prisma/client";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Unauthorized" };
  }

  const { id, boardId } = data;
  let label;

  try {
    label = await db.label.delete({
      where: { id, orgId },
    });

    await createAuditLog({
      entityId: label.id,
      entityTitle: label.name,
      entityType: ENTITY_TYPE.LABEL,
      action: ACTION.DELETE,
    });
  } catch {
    return { error: "Failed to delete label" };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: label };
};

export const deleteLabel = createSafeAction(DeleteLabel, handler);
