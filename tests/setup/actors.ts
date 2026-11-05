import { ACTOR_KIND, SURFACE } from "@prisma/client";
import { Actor, CAPABILITIES } from "@/lib/domain/actor";

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

/**
 * An agent with the plain Agent role, without a token. Domain tests use it;
 * token and MCP tests create a real token instead.
 */
export const agent = (orgId = "org_test", id = "token_agent"): Actor => ({
  kind: ACTOR_KIND.AGENT,
  id,
  name: "Test Agent",
  orgId,
  surface: SURFACE.MCP,
  tokenId: id,
  role: { key: "agent", name: "Agent", capabilities: [...CAPABILITIES] },
});
