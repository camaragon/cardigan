"use server";

import { auth } from "@clerk/nextjs/server";
import { InputType, ReturnType } from "./types";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { CreateBoard } from "./schema";
import { createAuditLog } from "@/lib/create-audit-log";
import { ACTION, ENTITY_TYPE } from "@prisma/client";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { orgId, userId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Unauthorized",
    };
  }

  const { title, image } = data;

  const [imageId, imageThumbUrl, imageFullUrl, imageLinkHTML, imageUserName] =
    image.split("|");

  console.log({
    imageId,
    imageThumbUrl,
    imageFullUrl,
    imageLinkHTML,
    imageUserName,
  });

  // Handle uploaded images differently
  let finalImageId = imageId;
  let finalThumbUrl = imageThumbUrl;
  let finalFullUrl = imageFullUrl;
  let finalLinkHTML = imageLinkHTML;
  let finalUserName = imageUserName;

  if (imageId === "uploaded") {
    // For uploaded images, use the data URL as both thumb and full URL
    finalImageId = `uploaded-${Date.now()}`;
    finalThumbUrl = imageThumbUrl; // This will be the data URL
    finalFullUrl = imageFullUrl; // This will be the same data URL
    finalLinkHTML = "";
    finalUserName = "Custom Upload";
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
        error: "Missing fields. Failed to create board",
      };
    }
  }

  let board;

  try {
    board = await db.board.create({
      data: {
        title,
        orgId,
        imageId: finalImageId,
        imageThumbUrl: finalThumbUrl,
        imageFullUrl: finalFullUrl,
        imageUserName: finalUserName,
        imageLinkHTML: finalLinkHTML,
      },
    });

    await createAuditLog({
      entityTitle: board.title,
      entityId: board.id,
      entityType: ENTITY_TYPE.BOARD,
      action: ACTION.CREATE,
    });
  } catch {
    return {
      error: "Failed to create board",
    };
  }

  revalidatePath(`/board/${board.id}`);
  return {
    data: board,
  };
};

export const createBoard = createSafeAction(CreateBoard, handler);
