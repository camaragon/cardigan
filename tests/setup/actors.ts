import { ACTOR_KIND, SURFACE } from "@prisma/client";
import type { Actor } from "@/lib/domain/actor";

/** People actors on the UI surface, as the server actions would build them. */
export const owner = (orgId = "org_test", id = "user_test"): Actor => ({
  kind: ACTOR_KIND.OWNER,
  id,
  name: "Test Owner",
  orgId,
  surface: SURFACE.UI,
});

export const member = (orgId = "org_test", id = "user_member"): Actor => ({
  kind: ACTOR_KIND.MEMBER,
  id,
  name: "Test Member",
  orgId,
  surface: SURFACE.UI,
});
