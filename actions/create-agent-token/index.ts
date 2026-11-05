"use server";

import { InputType, ReturnType } from "./types";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/create-safe-action";
import { CreateAgentToken } from "./schema";
import { createAgentToken as createAgentTokenInDomain } from "@/lib/domain/tokens";
import { errorMessage } from "@/lib/domain/errors";
import { getPersonActor } from "@/lib/domain/person";

const handler = async (data: InputType): Promise<ReturnType> => {
  const actor = await getPersonActor();

  if (!actor) {
    return {
      error: "Unauthorized",
    };
  }

  let created;

  try {
    created = await createAgentTokenInDomain(actor, data);
  } catch (error) {
    return {
      error: errorMessage(error, "Failed to create token"),
    };
  }

  revalidatePath(`/organization/${actor.orgId}/agents`);
  return {
    data: {
      tokenId: created.token.id,
      agentName: created.token.agentName,
      secret: created.secret,
    },
  };
};

export const createAgentToken = createSafeAction(CreateAgentToken, handler);
