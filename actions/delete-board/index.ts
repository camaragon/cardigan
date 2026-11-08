"use server";

import { getPersonActor } from "@/lib/domain/person";
import { InputType, ReturnType } from "./types";
import { deleteBoard as mutate } from "@/lib/domain/deletes";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { DeleteBoard } from "./schema";
import { redirect } from "next/navigation";
import { decrementAvailableCount } from "@/lib/org-limit";
import { checkSubscription } from "@/lib/subscription";

const handler = async (data: InputType): Promise<ReturnType> => {
  const actor = await getPersonActor();

  if (!actor) {
    return {
      error: "Unauthorized",
    };
  }

  const isPro = await checkSubscription();

  const { id } = data;

  try {
    await mutate(actor, { id });

    if (!isPro) {
      await decrementAvailableCount();
    }
  } catch {
    return {
      error: "Failed to delete board",
    };
  }

  revalidatePath(`/organization/${actor.orgId}`);
  redirect(`/organization/${actor.orgId}`);
};

export const deleteBoard = createSafeAction(DeleteBoard, handler);
