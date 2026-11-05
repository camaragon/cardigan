import { ACTOR_KIND, SURFACE } from "@prisma/client";
import type { Actor } from "@/lib/domain/actor";

export { owner, member } from "./actors";

const IMAGE = {
  imageId: "img",
  imageThumbUrl: "thumb",
  imageFullUrl: "full",
  imageUserName: "user",
  imageLinkHTML: "link",
};

/** Creates a board from a template and returns it with its lists by key. */
export async function seedBoard(
  actor: Actor,
  template: "plain" | "product",
  title = template === "product" ? "Product" : "Plain",
) {
  const { createBoard } = await import("@/lib/domain/boards");
  const { db } = await import("@/lib/db");
  const board = await createBoard(actor, { title, template, image: IMAGE });
  const lists = await db.list.findMany({ where: { boardId: board.id } });
  const byKey = Object.fromEntries(lists.map((l) => [l.templateKey!, l]));
  return { board, lists: byKey };
}

/**
 * An agent actor with one of the workspace's roles, without a token. Domain
 * tests use it; token and MCP tests use seedAgent.
 */
export async function roleActor(roleKey: string, orgId = "org_test"): Promise<Actor> {
  const { db } = await import("@/lib/db");
  const role = await db.agentRole.findUniqueOrThrow({
    where: { orgId_key: { orgId, key: roleKey } },
  });
  return {
    kind: ACTOR_KIND.AGENT,
    id: `token_${roleKey}`,
    name: `${roleKey} agent`,
    orgId,
    surface: SURFACE.MCP,
    tokenId: `token_${roleKey}`,
    role: { key: role.key, name: role.name, capabilities: role.capabilities },
  };
}

/** Creates an agent token through the owner and resolves it to an actor. */
export async function seedAgent(
  ownerActor: Actor,
  roleKey: string,
  agentName = `${roleKey} agent`,
) {
  const { createAgentToken, resolveAgentToken } = await import(
    "@/lib/domain/tokens"
  );
  const { token, secret } = await createAgentToken(ownerActor, {
    agentName,
    roleKey,
  });
  const actor = await resolveAgentToken(secret);
  if (!actor) throw new Error("token did not resolve");
  return { token, secret, actor };
}
