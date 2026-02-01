"use server";

import { auth } from "@clerk/nextjs/server";
import { InputType, ReturnType } from "./types";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { UpdateLabel } from "./schema";
import { createAuditLog } from "@/lib/create-audit-log";
import { ACTION, ENTITY_TYPE } from "@prisma/client";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Unauthorized" };
  }

  const { id, name, color, boardId } = data;
  let label;

  try {
    label = await db.label.update({
      where: { id, orgId },
      data: { name, color },
    });

    await createAuditLog({
      entityId: label.id,
      entityTitle: label.name,
      entityType: ENTITY_TYPE.LABEL,
      action: ACTION.UPDATE,
    });
  } catch {
    return { error: "Failed to update label" };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: label };
};

export const updateLabel = createSafeAction(UpdateLabel, handler);
