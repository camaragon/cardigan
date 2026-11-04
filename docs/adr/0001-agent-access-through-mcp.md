# Agents act through an MCP server over a shared domain layer

## Context

The [PRD](../product/prd.md) makes agents first-class actors. Today every mutation
is a server action that requires a Clerk `userId` and `orgId` (`actions/*/index.ts`),
and audit entries take their actor from Clerk `currentUser()`
(`lib/create-audit-log.ts`). Agents are not Clerk users, so they cannot call these
actions, and nothing they did could be attributed. Card moves are not audited at all
(`actions/update-card-order`). The owner asked whether the agent API should be
GraphQL rather than REST; they are fluent in GraphQL, Apollo and TanStack Query.

## Decision

Extract a TypeScript domain layer (plain functions, one per operation) that takes
an explicit actor: kind (person or agent), id, display name, workspace and surface
(UI or MCP). Authorization rules live there and nowhere else: workspace scoping,
Queue moves and ordering reserved to people, no deletes by agents, and read-only
Waiting on owner cards. Every domain mutation writes its own attributed audit entry,
including moves with source and target list.

Two front doors call the domain functions directly:

- **Server actions** resolve the Clerk session to a person actor, then call the
  domain function. The UI keeps its current `createSafeAction`/`useAction` contract.
- **An MCP server** on a Streamable HTTP route inside the Next.js app (for example
  `/api/mcp`) resolves a bearer agent token to an agent actor, then calls the same
  functions. The route skips Clerk session protection in `proxy.ts` and rejects any
  request without a valid token. Tools are task-shaped (list, search, create with
  an external key, move, comment, changes since a cursor, report friction), not a
  mirror of every table.

Agent tokens are random secrets with a recognizable prefix, stored only as a hash,
bound to exactly one workspace, named for one agent, and checked on every call; the
owner creates and revokes them in workspace settings. The single cross-workspace
write is friction reporting, which may only create a proposal on Cardigan's own
workspace and returns nothing from it.

**No public REST or GraphQL API in the first slice.** Both front doors are in the
same process and call the domain layer directly, so a network API would add a
schema, versioning and a second auth path without a consumer. If a general-purpose
external API is needed later (a non-MCP client, a separate frontend, third-party
integrations), prefer GraphQL over REST: the board, list, card and activity graph
suits nested selections, the owner already works fluently in GraphQL with Apollo and
TanStack Query, and it would sit over the same domain layer. Choose REST only if
that consumer specifically needs plain HTTP caching or webhook-style endpoints.

Alternatives considered: a local stdio MCP server talking to the database (every
agent host would need database credentials, and authorization would live outside
the app); REST endpoints under the MCP server (an extra hop and a public interface
with no consumer); Clerk-managed machine identities (deferred, because one
workspace-bound, owner-revocable credential per agent is simple to own here and
keeps agents out of workspace membership).

## Consequences

The schema gains agent tokens, card comments, a per-workspace unique external key
on cards, a role on lists (Proposals, Queue, Done, Waiting on owner) so agents
address lists by role rather than title, and actor kind, actor id, surface and move
fields on audit entries. Existing audit rows become person entries. These are
additive but data-bearing, so they wait for the migration baseline in
[ADR 0002](0002-private-deployment.md).

Server actions become thin wrappers, so the UI and agents cannot drift on rules.
A leaked token exposes one workspace until revoked; it can never delete data or
change the owner's priority order. Adding GraphQL later is a new front door over
the same functions, not a rewrite.
