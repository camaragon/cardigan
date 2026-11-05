"use server";

import { InputType, ReturnType } from "./types";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { CreateAgentToken } from "./schema";
import { createAgentToken as createAgentTokenInDomain } from "@/lib/domain/tokens";
import { runAsPerson } from "@/lib/domain/run-as-person";

const handler = async (data: InputType): Promise<ReturnType> => {
  const result = await runAsPerson("Failed to create token", async (actor) => {
    const { token, secret } = await createAgentTokenInDomain(actor, data);
    revalidatePath(`/organization/${actor.orgId}/agents`);
    return { tokenId: token.id, agentName: token.agentName, secret };
  });
  return result;
};

export const createAgentToken = createSafeAction(CreateAgentToken, handler);
