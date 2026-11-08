import { ACTOR_KIND, SURFACE } from "@prisma/client";
import { DomainError } from "./errors";

/** Core capabilities an agent role may hold (ADR 0004). */
export const CAPABILITIES = [
  "create",
  "update",
  "move",
  "comment",
  "duplicate",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export interface AgentRoleRef {
  key: string;
  name: string;
  capabilities: string[];
}

/**
 * Who is calling a domain function. Every domain function takes one, and all
 * authorization and attribution is derived from it (ADR 0001).
 */
export interface Actor {
  kind: ACTOR_KIND;
  /** Clerk user id for people, agent token id for agents. */
  id: string;
  name: string;
  image?: string | null;
  /** The workspace (Clerk organization) the actor acts in. */
  orgId: string;
  surface: SURFACE;
  /** Set for agents only. */
  role?: AgentRoleRef;
  /** Set for agents only: the token id, never the secret. */
  tokenId?: string;
}

export const isAgent = (actor: Actor) => actor.kind === ACTOR_KIND.AGENT;
export const isOwner = (actor: Actor) => actor.kind === ACTOR_KIND.OWNER;

export const hasCapability = (actor: Actor, capability: Capability) =>
  !isAgent(actor) || Boolean(actor.role?.capabilities.includes(capability));

/** Key scope for retry-safe external keys: the agent's role, or the person kind. */
export const keyScope = (actor: Actor) =>
  actor.role ? `role:${actor.role.key}` : `person:${actor.id}`;

/** Clerk organization role that makes a person the workspace owner. */
export const OWNER_ORG_ROLE = "org:admin";

/** Catalog mutations retain their existing people-only authority. */
export const requirePerson = (actor: Actor) => {
  if (isAgent(actor)) throw new DomainError("denied", "Only people can change workspace structure");
};
