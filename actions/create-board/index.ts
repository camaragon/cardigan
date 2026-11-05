"use server";

import { auth } from "@clerk/nextjs/server";
import { InputType, ReturnType } from "./types";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { CreateBoard } from "./schema";
import { createBoard as createBoardInDomain } from "@/lib/domain/boards";
import { runAsPerson } from "@/lib/domain/run-as-person";
import { incrementAvailableCount, hasAvailableCount } from "@/lib/org-limit";
import { checkSubscription } from "@/lib/subscription";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { orgId, userId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Unauthorized",
    };
  }

  const canCreate = await hasAvailableCount();
  const isPro = await checkSubscription();

  if (!canCreate && !isPro) {
    return {
      error:
        "You have reached the limit of free boards. Please upgrade to create more.",
    };
  }

  const { title, image, template } = data;

  const [imageId, imageThumbUrl, imageFullUrl, imageLinkHTML, imageUserName] =
    image.split("|");

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

  const result = await runAsPerson("Failed to create board", (actor) =>
    createBoardInDomain(actor, {
      title,
      template: template ?? "plain",
      image: {
        imageId: finalImageId,
        imageThumbUrl: finalThumbUrl,
        imageFullUrl: finalFullUrl,
        imageUserName: finalUserName,
        imageLinkHTML: finalLinkHTML,
      },
    }),
  );
  const board = result.data;
  if (!board) return { error: result.error };

  if (!isPro) {
    await incrementAvailableCount();
  }

  revalidatePath(`/board/${board.id}`);
  return {
    data: board,
  };
};

export const createBoard = createSafeAction(CreateBoard, handler);
