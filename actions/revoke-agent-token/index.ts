"use server";

import { InputType, ReturnType } from "./types";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { RevokeAgentToken } from "./schema";
import { revokeAgentToken as revokeAgentTokenInDomain } from "@/lib/domain/tokens";
import { errorMessage } from "@/lib/domain/errors";
import { getPersonActor } from "@/lib/domain/person";

const handler = async (data: InputType): Promise<ReturnType> => {
  const actor = await getPersonActor();

  if (!actor) {
    return {
      error: "Unauthorized",
    };
  }

  let token;

  try {
    token = await revokeAgentTokenInDomain(actor, data.tokenId);
  } catch (error) {
    return {
      error: errorMessage(error, "Failed to revoke token"),
    };
  }

  revalidatePath(`/organization/${actor.orgId}/agents`);
  return { data: { tokenId: token.id } };
};

export const revokeAgentToken = createSafeAction(RevokeAgentToken, handler);
