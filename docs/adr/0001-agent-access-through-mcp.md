# Agents act through an MCP server over a shared domain layer

## Context

The [PRD](../product/prd.md) makes agents first-class actors. Today every mutation
is a server action that requires a Clerk `userId` and `orgId` (`actions/*/index.ts`),
and audit entries take their actor from Clerk `currentUser()`
(`lib/create-audit-log.ts`). Agents are not Clerk users, so they cannot call these
actions, and nothing they did could be attributed. Card moves are not audited at all
(`actions/update-card-order`). The owner asked for an MCP server built on one shared
internal API, REST under the hood, and asked whether GraphQL would be better; they
are fluent in GraphQL, Apollo and TanStack Query.

## Decision

Extract a TypeScript domain layer (plain functions, one per operation) that takes
an explicit actor: kind (owner, other person or agent), agent role if any, id,
display name, workspace and surface (UI or MCP). Authorization lives there and
nowhere else, so every entry point enforces it:

- Every call is scoped to the actor's workspace.
- Agents never delete and never manage tokens or workspace settings.
- Edits carry the version they were based on; a stale version is rejected rather
  than overwriting an owner change.
- Workflow rules (who may move into or reorder a list, locked cards, what each
  agent role may do) are read from workspace settings, not coded per workflow
  ([ADR 0004](0004-workflow-rules-in-templates.md)). The product template's
  owner-only Queued list and supervisor-only owner-call cards are such settings.

Every domain mutation writes its attributed audit entry in the same transaction,
including moves with source and target list.

Two front doors call the domain functions directly:

- **Server actions** resolve the Clerk session to a person actor, then call the
  domain function. The UI keeps its current `createSafeAction`/`useAction` contract.
- **An MCP server** on a Streamable HTTP route inside the Next.js app (for example
  `/api/mcp`) resolves a bearer agent token to an agent actor, then calls the same
  functions. The route skips Clerk session protection in `proxy.ts` and rejects any
  request without a valid token. Tools are task-shaped, as listed in PRD C-2, not a
  mirror of every table. Results are paginated and errors typed; each call,
  including failures, is recorded in a tool-call log with the token id, never the
  secret or the raw payload.

This direct in-process call departs from the owner's D2 answer ("REST under the
hood") and is pending the owner's confirmation. The reason: both front doors run in
the same process, so an internal REST layer would add routes, serialization and a
second auth path without a separate consumer. If the owner keeps D2, the MCP tools
call a private internal REST layer over the same domain functions instead; the
authorization rules above do not change.

A general-purpose external API is out of scope. If one is needed later (a non-MCP
client, a separate frontend, third-party integrations), GraphQL, which the owner
knows well with Apollo and TanStack Query, and REST are both options to decide
then. Neither is chosen now.

Agent tokens are random secrets with a recognizable prefix, stored only as a hash,
bound to exactly one workspace, named for one agent with one role, and checked on
every call. The owner creates and revokes them in workspace settings.

The single cross-workspace path, pending the owner's confirmation, is friction
reporting: any token may write a friction report into Cardigan's own workspace and
receives only a receipt. It cannot read, update or list anything there. Reports
carry a retry key and a fingerprint for grouping repeats.

Alternatives considered: a local stdio MCP server talking to the database (every
agent host would need database credentials, and authorization would live outside
the app); Clerk-managed machine identities (deferred, because one workspace-bound,
owner-revocable credential per agent is simple to own here and keeps agents out of
workspace membership).

## Consequences

The schema gains agent tokens, card comments, card versions, a per-workspace
unique external key on cards, duplicate links, friction reports and groups, a
tool-call log, and actor kind, actor id, surface and move fields on audit entries.
Audit entries also gain an event id for the changes cursor; the cursor only
advances past events whose transactions have committed, so a concurrent write
cannot be skipped. Existing audit rows become person entries. Rule settings and
agent roles are covered in ADR 0004. These are additive but data-bearing, so they
wait for the migration baseline in
[ADR 0002](0002-private-deployment.md).

Server actions become thin wrappers, so the UI and agents cannot drift on rules.
A leaked token exposes one workspace until revoked; it can never delete data,
change workspace settings, or act beyond its role's list rules. A later network API, internal or external, is a
new front door over the same functions, not a rewrite.
