import { Actor } from "./actor";
import { errorMessage } from "./errors";
import { getPersonActor } from "./person";

/**
 * Server action glue: resolves the Clerk session to a person actor and runs a
 * domain function, mapping domain errors to the UI's `{ error }` result.
 */
export const runAsPerson = async <T>(
  fallback: string,
  fn: (actor: Actor) => Promise<T>,
): Promise<{ data?: T; error?: string }> => {
  const actor = await getPersonActor();
  if (!actor) return { error: "Unauthorized" };
  try {
    return { data: await fn(actor) };
  } catch (error) {
    if (!(error instanceof Error && error.name === "DomainError")) {
      console.error("[DOMAIN_ACTION_ERROR]", error);
    }
    return { error: errorMessage(error, fallback) };
  }
};
