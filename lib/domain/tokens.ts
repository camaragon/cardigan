import { createHash, randomBytes } from "node:crypto";
import { ACTION, ACTOR_KIND, ENTITY_TYPE, SURFACE } from "@prisma/client";
import { db } from "@/lib/db";
import { Actor, CAPABILITIES, isOwner } from "./actor";
import { transaction, writeAudit } from "./audit";
import { DomainError, notFound } from "./errors";

/** Recognizable prefix for agent token secrets. */
export const TOKEN_PREFIX = "cdg_";

/**
 * The general agent role every workspace can use. It holds every capability
 * and is added to the workspace the first time a token uses it.
 */
export const AGENT_ROLE = {
  key: "agent",
  name: "Agent",
  capabilities: [...CAPABILITIES],
};

export const hashSecret = (secret: string) =>
  createHash("sha256").update(secret).digest("hex");

/** Owners manage tokens, and only in the UI: agents never can (PRD C-4). */
const requireOwnerInUi = (actor: Actor) => {
  if (!isOwner(actor) || actor.surface !== SURFACE.UI) {
    throw new DomainError("denied", "Only the owner can manage agent tokens", {
      rule: "workspace.tokens",
      allowed: ["the owner, in the app"],
      alternative: "Ask the owner to create or revoke the token.",
    });
  }
};

/**
 * Creates a token for one agent with one of the workspace's agent roles. The
 * secret is returned once and only its hash is stored (PRD C-1).
 */
export const createAgentToken = async (
  actor: Actor,
  input: { agentName: string; roleKey: string },
) => {
  requireOwnerInUi(actor);

  const secret = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;

  const token = await transaction(async (tx) => {
    if (input.roleKey === AGENT_ROLE.key) {
      await tx.agentRole.upsert({
        where: { orgId_key: { orgId: actor.orgId, key: AGENT_ROLE.key } },
        update: {},
        create: { orgId: actor.orgId, ...AGENT_ROLE },
      });
    }
    const role = await tx.agentRole.findUnique({
      where: { orgId_key: { orgId: actor.orgId, key: input.roleKey } },
    });
    if (!role) throw notFound("Agent role");

    const token = await tx.agentToken.create({
      data: {
        orgId: actor.orgId,
        agentName: input.agentName,
        roleId: role.id,
        secretHash: hashSecret(secret),
        prefix: secret.slice(0, TOKEN_PREFIX.length + 6),
        createdById: actor.id,
      },
      include: { role: true },
    });
    await writeAudit(tx, actor, {
      action: ACTION.CREATE,
      entityType: ENTITY_TYPE.AGENT_TOKEN,
      entityId: token.id,
      entityTitle: `${token.agentName} (${role.name})`,
    });
    return token;
  });

  return { token, secret };
};

export const revokeAgentToken = async (actor: Actor, tokenId: string) => {
  requireOwnerInUi(actor);
  return transaction(async (tx) => {
    const token = await tx.agentToken.findFirst({
      where: { id: tokenId, orgId: actor.orgId },
      include: { role: true },
    });
    if (!token) throw notFound("Agent token");
    if (token.revokedAt) return token;

    const revoked = await tx.agentToken.update({
      where: { id: token.id },
      data: { revokedAt: new Date() },
      include: { role: true },
    });
    await writeAudit(tx, actor, {
      action: ACTION.REVOKE,
      entityType: ENTITY_TYPE.AGENT_TOKEN,
      entityId: token.id,
      entityTitle: `${token.agentName} (${token.role.name})`,
    });
    return revoked;
  });
};

export const listAgentTokens = (actor: Actor) => {
  requireOwnerInUi(actor);
  return db.agentToken.findMany({
    where: { orgId: actor.orgId },
    include: { role: true },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Resolves a bearer secret to an agent actor, or null for an unknown or
 * revoked token. Writes nothing: such calls never reach a workspace.
 */
export const resolveAgentToken = async (
  secret: string,
): Promise<Actor | null> => {
  if (!secret.startsWith(TOKEN_PREFIX)) return null;
  const token = await db.agentToken.findUnique({
    where: { secretHash: hashSecret(secret) },
    include: { role: true },
  });
  if (!token || token.revokedAt) return null;

  // Coarse last-used time for the Agents page; not an audit entry.
  if (!token.lastUsedAt || Date.now() - token.lastUsedAt.getTime() > 60_000) {
    await db.agentToken.update({
      where: { id: token.id },
      data: { lastUsedAt: new Date() },
    });
  }

  return {
    kind: ACTOR_KIND.AGENT,
    id: token.id,
    name: token.agentName,
    orgId: token.orgId,
    surface: SURFACE.MCP,
    tokenId: token.id,
    role: {
      key: token.role.key,
      name: token.role.name,
      capabilities: token.role.capabilities,
    },
  };
};
