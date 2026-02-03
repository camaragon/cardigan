"use server";

import { auth } from "@clerk/nextjs/server";
import { InputType, ReturnType } from "./types";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { UpdateBoard } from "./schema";
import { createAuditLog } from "@/lib/create-audit-log";
import { ACTION, ENTITY_TYPE } from "@prisma/client";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Unauthorized",
    };
  }

  const { title, image, id } = data;

  // Build update data object
  const updateData: {
    title?: string;
    imageId?: string;
    imageThumbUrl?: string;
    imageFullUrl?: string;
    imageLinkHTML?: string;
    imageUserName?: string;
  } = {};

  if (title) {
    updateData.title = title;
  }

  if (image) {
    const [imageId, imageThumbUrl, imageFullUrl, imageLinkHTML, imageUserName] =
      image.split("|");

    if (imageId === "uploaded") {
      // For uploaded images, use the data URL as both thumb and full URL
      updateData.imageId = `uploaded-${Date.now()}`;
      updateData.imageThumbUrl = imageThumbUrl;
      updateData.imageFullUrl = imageFullUrl;
      updateData.imageLinkHTML = "";
      updateData.imageUserName = "Custom Upload";
    } else {
      // For Unsplash images, validate all fields are present
      if (
        !imageId ||
        !imageThumbUrl ||
        !imageFullUrl ||
        !imageLinkHTML ||
        !imageUserName
      ) {
        return {
          error: "Missing image fields. Failed to update board",
        };
      }
      updateData.imageId = imageId;
      updateData.imageThumbUrl = imageThumbUrl;
      updateData.imageFullUrl = imageFullUrl;
      updateData.imageLinkHTML = imageLinkHTML;
      updateData.imageUserName = imageUserName;
    }
  }

  let board;

  try {
    board = await db.board.update({
      where: {
        id,
        orgId,
      },
      data: updateData,
    });

    await createAuditLog({
      entityTitle: board.title,
      entityId: board.id,
      entityType: ENTITY_TYPE.BOARD,
      action: ACTION.UPDATE,
    });
  } catch {
    return {
      error: "Failed to update board",
    };
  }

  revalidatePath(`/board/${id}`);
  return { data: board };
};

export const updateBoard = createSafeAction(UpdateBoard, handler);
