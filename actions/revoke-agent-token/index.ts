"use server";

import { InputType, ReturnType } from "./types";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { RevokeAgentToken } from "./schema";
import { revokeAgentToken as revokeAgentTokenInDomain } from "@/lib/domain/tokens";
import { runAsPerson } from "@/lib/domain/run-as-person";

const handler = async (data: InputType): Promise<ReturnType> => {
  return runAsPerson("Failed to revoke token", async (actor) => {
    const token = await revokeAgentTokenInDomain(actor, data.tokenId);
    revalidatePath(`/organization/${actor.orgId}/agents`);
    return { tokenId: token.id };
  });
};

export const revokeAgentToken = createSafeAction(RevokeAgentToken, handler);
