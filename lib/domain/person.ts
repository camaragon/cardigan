import { auth, currentUser } from "@clerk/nextjs/server";
import { ACTOR_KIND, SURFACE } from "@prisma/client";
import { Actor, OWNER_ORG_ROLE } from "./actor";

/**
 * Resolves the Clerk session to a person actor on the UI surface, or null
 * when signed out or without an active workspace. Every admin of the
 * workspace's organization holds the owner role (PRD).
 */
export const getPersonActor = async (): Promise<Actor | null> => {
  const { userId, orgId, orgRole } = await auth();
  if (!userId || !orgId) return null;
  const user = await currentUser();
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    "Member";
  return {
    kind: orgRole === OWNER_ORG_ROLE ? ACTOR_KIND.OWNER : ACTOR_KIND.MEMBER,
    id: userId,
    name,
    image: user?.imageUrl ?? null,
    orgId,
    surface: SURFACE.UI,
  };
};
