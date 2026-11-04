# Cardigan: an agent-native task board

Status: draft
Maintainer: owner · Updated: 2026-11-04
Decisions: [agent access](../adr/0001-agent-access-through-mcp.md), [private deployment](../adr/0002-private-deployment.md), [backlog stays authoritative during transition](../adr/0003-backlog-authoritative-during-transition.md), [workflow rules as templates and settings](../adr/0004-workflow-rules-in-templates.md)

## Problem and why now

The owner works with AI agents across several workflows: product work, admin and
client to-dos. Tasks, priorities and open questions are scattered across chats and
agent task files. There is no shared board where people and agents both read and
change work with every action attributed. Cardigan is a working Kanban board with no
users yet besides the owner, so it can be reshaped now without migrating anyone.

## Goal and boundaries

Make Cardigan a general task board that people and agents use as equals, and that
improves through that use.

- **General core:** workspaces (one Clerk organization each), boards, lists, cards,
  comments, labels and an activity log, fit for any workflow. A workspace's owner
  is its Clerk organization admin.
- **Agent-native:** agents are first-class actors through an MCP server, every
  human and agent action is attributed, and agents report friction they hit.
- **One shared layer:** the UI and MCP share one authorization and domain layer.
  Whether MCP calls it directly in-process (proposed in ADR 0001) or through the
  internal REST API the owner originally named is pending the owner's
  confirmation. A public API is out of scope.
- **Templates:** a workspace starts from a template. The plain template has To do,
  Doing and Done with no rules. The product template adds product management on
  top (below). Workflow rules are workspace settings, never core code (ADR 0004).

Non-goals: public hosting, billing, agent deletes, answering questions inside
Cardigan, a separate analytics product, and replacing the supervisor agent's
backlog as the record of execution progress (ADR 0003).

## Product template

Used by each of the owner's product workspaces, including Cardigan's own. Lists:
Proposed, Queued, In flight, Waiting on owner, Done. Agent roles: a PM agent
proposes, comments and tidies; a supervisor agent executes from its own backlog and
reflects progress. Only the owner moves cards into Queued or orders it; Queued
order is the owner's priority order. Waiting on owner cards mirror open questions
for the owner, are read-only, and are answered in chat.

The template's friction flywheel:

1. **Structured evidence:** a friction report records source workspace, affected
   component, agent, tool and version, error category, impact, a redacted evidence
   reference and a correlation id. Tokens and raw chat are never captured.
2. **Repeat detection:** a retry key stops duplicates; a fingerprint groups
   recurring friction with occurrence count and first and last seen.
3. **Regular triage:** on a fixed cadence the PM agent turns recurring or
   high-impact signals into proposals with a measurable hypothesis and linked
   evidence, on the affected product's board or Cardigan's. The owner decides.
4. **Close the loop:** signal, proposal, backlog task, shipped change and the
   post-change recurrence are linked. Cross-workspace summaries are sanitized and
   permission-scoped; no agent gains reads in another workspace.

## Success

From the activity log: card cycle time and, on product boards, proposal-to-decision
time and share queued versus closed. From friction records: reports filed, grouped
and resolved, and recurrence after a fix. From the MCP tool-call log: tool error
rate. Owner active time is deferred until it has an event source. Targets wait for a
baseline.

## Acceptance criteria: core

- **C-1 Agent tokens:** the owner creates a token for one agent with one of the
  workspace's agent roles; it is shown once and stored only as a hash. Except for
  C-9, calls act only in its workspace: other workspaces' ids return not found.
  After revocation the next call fails as unauthorized. Both events are logged.
- **C-2 MCP tools:** discover boards and lists; list and search cards; get a card
  with comments, labels, provenance and activity; create, update, move and comment
  on cards; link a duplicate to its canonical card; read changes; report friction.
  Results are paginated, errors typed, mutations retry-safe, and an edit based on a
  stale version is rejected.
- **C-3 Idempotent create:** two creates with the same external key in one
  workspace return the same card id and leave one card and one create entry.
- **C-4 No agent deletes:** no MCP tool deletes a board, list, card, label or
  comment, and no agent can create, change or revoke tokens or workspace settings.
- **C-5 Attribution:** every agent mutation and failed tool call writes an entry
  naming the agent, its token id (never the secret) and the MCP surface; the
  activity view shows agents distinctly from people. Human entries record the UI.
- **C-6 Audited moves:** every move, including an owner drag, writes an entry with
  the card, source list, target list and position.
- **C-7 Changes query:** paging from any cursor while other events are written
  returns every event id exactly once, in order.
- **C-8 Rules from settings:** a list's entry, reorder and read-only-card settings
  are enforced for every actor in the UI and MCP; only the owner changes them, and
  each change is logged. A plain-template board lets any member or agent move any
  card.
- **C-9 Friction reports:** as a narrow, write-only exception to C-1 (pending the
  owner's confirmation), any token can report friction onto Cardigan's workspace and
  gets only a receipt back. A replayed report stores one record; a repeated
  fingerprint increments one group.
- **C-10 Private mode:** with private mode on and no Stripe or Unsplash keys, the
  app builds and runs; no billing page, upgrade prompt or board cap appears, Stripe
  is never called, and boards get a default background. Access from the tailnet
  succeeds and access from outside it fails.
- **C-11 Workspaces:** Clerk sign-in and organization switching keep working, and a
  person sees only boards in workspaces they belong to.

## Acceptance criteria: product template

- **P-1 Setup:** a board created from the product template has the five lists, the
  PM and supervisor roles and the rules below, all visible as settings.
- **P-2 Queue authority:** only the owner may create a card in, move a card into, or
  reorder Queued, through any entry point; other people and all agents are denied.
- **P-3 Role split:** PM tokens create and tidy cards in Proposed and comment.
  Supervisor tokens alone move Queued cards to In flight and Done and upsert or
  resolve Waiting on owner cards keyed to a backlog task, with a source reference.
- **P-4 Owner-call cards:** Waiting on owner cards reject every other edit, move or
  delete in the UI and MCP, and say to answer in chat.
- **P-5 Approval visible:** after the owner queues a proposal, the changes query
  returns that move attributed to the owner.
- **P-6 Flywheel:** triage of a recurring friction group produces one
  evidence-linked proposal, and one post-ship recurrence measurement is recorded.
