# Agents act through an MCP server over a shared domain layer

Status: proposed. Pending the owner's confirmation: in-process calls instead of an
internal REST layer, and the write-only friction exception.

## Context

The [PRD](../product/prd.md) gives agents the same footing as people. Today every
mutation is a server action that requires a Clerk `userId` and `orgId`
(`actions/*/index.ts`), and audit entries take their actor from Clerk
`currentUser()` (`lib/create-audit-log.ts`). Agents are not Clerk users, so they
cannot call these actions, and nothing they did could be attributed. Card moves are
not audited at all (`actions/update-card-order`). The owner asked for an MCP server
built on one shared internal API with REST underneath, and asked whether GraphQL
would be better; they are fluent in GraphQL, Apollo and TanStack Query.

## Decision

Extract a TypeScript domain layer (plain functions, one per operation) that takes
an explicit actor: kind (owner, other person or agent), agent role if any, id,
display name, workspace and surface (UI or MCP). Authorization lives there and
nowhere else, so every entry point enforces it:

- Every call is scoped to the actor's workspace.
- Agents never delete and never manage tokens or workspace settings.
- Workflow rules are read from settings, not coded per workflow
  ([ADR 0004](0004-workflow-rules-in-templates.md)).
- Creates and comments carry an external key, unique per workspace and key scope
  (the token's role, or a fixed friction scope). The same key and payload return the
  existing record; the same key with a different payload returns a conflict error.
- Each card has an integer version covering its own fields and list, not its
  position, so a sibling reorder does not stale it. UI and agent moves go through the
  same single-card move. An update or move with a stale version is rejected with
  the current card and its last actor, so a retrying agent can tell whether its
  own change landed.

Every domain mutation writes its attributed audit entry in the same transaction,
including moves with source and target list. A failed agent call writes one entry
with its outcome and error type; these appear in the activity view under failed
calls and not in the changes query. A call with an invalid or revoked token is
rejected before it reaches a workspace and writes no entry. The audit log is the
only record of calls; entries hold the token id, never the secret or raw payload.

The entry points call the domain functions directly:

- **Server actions** resolve the Clerk session to a person actor, then call the
  domain function. The UI keeps its `createSafeAction`/`useAction` contract, and
  domain functions reuse the existing `actions/*/schema.ts` Zod schemas.
- **The existing read routes** (`app/api/cards/[cardId]`, its `logs` route and
  `app/api/labels`), which check the Clerk session and `orgId` themselves today,
  become thin wrappers over domain reads. The full-card read also backs get-card.
- **An MCP server** on a Streamable HTTP route in the Next.js app (for example
  `/api/mcp`), built with the official MCP TypeScript SDK, resolves a bearer agent
  token to an agent actor and calls the same functions with the same schemas. The
  route skips Clerk session protection in `proxy.ts` and rejects any request without
  a valid token. Tools are task-shaped (PRD C-2). Results are paginated, errors
  typed, board results omit image fields (uploaded backgrounds are stored as data
  URLs), and get-card returns a paged slice of activity.

This direct in-process call departs from the owner's request for an internal REST
layer and is pending the owner's confirmation. Both entry points run in the same
process, so an internal REST layer would add routes, serialization and a second
auth path without a separate consumer. If the owner keeps the internal REST layer,
the MCP tools call it over the same domain functions; the rules above do not change.

A general-purpose external API is out of scope. If one is needed later (a non-MCP
client, a separate frontend, third-party integrations), GraphQL and REST are both
options to decide then.

Agent tokens are random secrets with a recognizable prefix, stored only as a hash,
bound to one workspace, named for one agent with one role, and checked on every
call. The owner creates and revokes them in workspace settings.

The single cross-workspace path, pending the owner's confirmation, is friction
reporting: any token may file a report into Cardigan's own workspace and receives
only whether it was new or a repeat. It cannot read, update or list anything there.
The agent sends a report key, a component and an error category from fixed lists
set by the server, the tool name, an impact (low, medium or high) and a redacted
description under a length limit. Each token may file a limited number per hour.
The server computes the fingerprint from component, tool and category; this is
deliberately coarse, so different problems with one tool may share a card and are
split by the PM agent. A report is a card in the Friction list of Cardigan's board
with the fingerprint as its external key; each new report key adds one comment. A
new report on a card labelled Resolved removes the label and comments a regression.
Report text is untrusted input and is readable by Cardigan workspace members.

Alternatives considered: a local stdio MCP server talking to the database (every
agent host would need database credentials, and authorization would live outside
the app); Clerk-managed machine identities (deferred: they need machine-identity
setup in Clerk, and a workspace-bound token keeps agents out of membership).

## Consequences

The schema gains agent tokens, card comments with an optional external key, an
integer version on cards, a per-workspace, per-scope external key on cards,
duplicate links, and actor kind, actor id, surface, outcome and move fields on audit
entries. Audit entries gain an event id for the changes cursor, assigned in commit
order; serializing audit inserts per workspace is acceptable for one owner and a few
agents per workspace. Existing audit rows become person entries. ADR 0004 covers
rule settings and agent roles. These changes wait for the migration baseline in
[ADR 0002](0002-private-deployment.md).

Server actions and read routes become thin wrappers, so the UI and agents cannot
drift on rules. A leaked token exposes one workspace until revoked; it can never
delete data, change settings, or act beyond its role's rules. A later network API,
internal or external, is a new entry point over the same functions, not a rewrite.
