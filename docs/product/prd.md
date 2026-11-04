# Cardigan: an agent-native product tracking board

Status: draft
Maintainer: owner · Updated: 2026-11-04
Decisions: [agent access](../adr/0001-agent-access-through-mcp.md), [private deployment](../adr/0002-private-deployment.md), [backlog stays authoritative during transition](../adr/0003-backlog-authoritative-during-transition.md)

## Problem and why now

The owner runs several products with AI agents: a supervisor agent that executes
work from its own backlog, and a PM agent that proposes and grooms work. Proposals,
priorities and open questions for the owner are scattered across chats and task
files, so the owner has no single place to see and order each product's work, and
agents have no structured way to read or propose it. Cardigan has no users yet
besides the owner, so it can be reshaped now without migrating anyone.

## Goal and boundaries

Make Cardigan a standalone product tracking board that agents use as first-class
actors through an MCP server, and that improves through that use.

- **Product workspaces:** one Clerk organization (workspace) per product. Cardigan
  is a product too and has its own workspace. Products are never mixed on one board.
- **One shared layer:** the UI and MCP share one authorization and domain layer.
  Whether MCP calls it directly in-process (proposed in ADR 0001) or through the
  internal REST API the owner originally named is pending the owner's
  confirmation. A public API is out of scope.
- **Agents propose; the owner decides:** the PM agent creates, comments on and
  tidies proposals. Only the owner puts cards into the Queue or orders it; Queue
  order is the owner's priority order.
- **Waiting on owner:** the supervisor agent mirrors open questions for the owner as
  read-only cards on the product's board. Answers stay in chat.

Non-goals: public hosting, billing, agent deletes, answering owner questions in
Cardigan, a separate analytics product, and replacing the supervisor agent's
backlog as the record of execution progress (ADR 0003).

## Flywheel

1. **Structured evidence:** a friction report records source product, affected
   component, agent, tool and version, error category, impact, a redacted evidence
   reference and a correlation id. Failed MCP tool calls are captured as well as
   successful mutations. Tokens and raw chat are never captured.
2. **Repeat detection:** a retry key stops duplicate reports; a fingerprint groups
   recurring friction with occurrence count and first and last seen.
3. **Regular triage:** on a fixed cadence the PM agent turns recurring or
   high-impact signals into proposals with a measurable hypothesis and linked
   evidence. Product-specific fixes go to that product's board; shared fixes go to
   Cardigan's. The owner still decides what is queued.
4. **Close the loop:** signal, proposal, backlog task, shipped change and the
   post-change recurrence are linked. Cross-product summaries are sanitized and
   permission-scoped; no agent gains reads in another workspace.

## Success

Measured from the activity log: proposal-to-decision time and share of proposals
queued versus closed. From friction records: reports filed, grouped and resolved,
and recurrence after a fix. From the MCP tool-call log: tool error rate. Owner
active time is deferred until it has an event source. Targets wait for a baseline.

## Acceptance criteria

- **AC-1 Agent tokens:** the owner creates a token named for one agent with a role
  (PM or supervisor); it is shown once and stored only as a hash. Except for AC-10,
  calls act only in its workspace: other workspaces' ids return not found. After
  revocation the next call fails as unauthorized. Creation and revocation are logged.
- **AC-2 MCP tools:** discover boards and list roles; list and search cards and the
  ordered Queue; get a card with comments, labels, provenance and activity; create a
  proposal; update its title, body and labels; link a duplicate to its canonical
  proposal; comment; read changes; report friction. Supervisor only: move a queued
  card to Done and upsert or resolve an owner-call card keyed to its backlog task.
  Lists are addressed by role, results are paginated, errors are typed, mutations
  are retry-safe, and an edit based on a stale version is rejected.
- **AC-3 Idempotent create:** two creates with the same external key in one
  workspace return the same card id and leave one card and one create entry.
- **AC-4 No agent deletes:** no MCP tool deletes a board, list, card, label or
  comment, and no agent can create, change or revoke tokens.
- **AC-5 Queue authority:** only the owner may create a card in, move a card into,
  or reorder the Queue, through any entry point. Other people and all agent tokens
  are denied, and nothing changes.
- **AC-6 Attribution:** every agent mutation and failed tool call writes an entry
  naming the agent, its token id (never the secret) and the MCP surface; the
  activity view shows agents distinctly from people. Human entries record the UI.
- **AC-7 Audited moves:** an owner drag between or within lists writes an entry
  with the card, source list, target list and position.
- **AC-8 Approval visible to agents:** after the owner queues a proposal, the
  changes query returns that move attributed to the owner. Paging from any cursor
  while other events are written returns every event id exactly once, in order.
- **AC-9 Owner-call cards:** PM tokens cannot resolve owner calls or mark queued
  work Done; supervisor tokens can, with a source reference. Owner-call cards reject
  every other edit, move or delete in the UI and MCP, and say to answer in chat.
- **AC-10 Friction reports:** as a narrow, write-only exception to AC-1 (pending
  the owner's confirmation), any token can report friction onto Cardigan's
  workspace and gets only a receipt back. A replayed report stores one record; a
  repeated fingerprint increments one group; triage produces one evidence-linked
  proposal; one post-ship recurrence measurement is recorded.
- **AC-11 Private mode:** with private mode on and no Stripe or Unsplash keys, the
  app builds and runs; no billing page, upgrade prompt or board cap appears, Stripe
  is never called, and boards get a default background. Access from the tailnet
  succeeds and access from outside it fails.
- **AC-12 Workspaces:** Clerk sign-in and organization switching keep working, and
  a person sees only boards in workspaces they belong to.
