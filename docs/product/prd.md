# Cardigan: an agent-native task board

Status: draft
Maintainer: owner · Updated: 2026-11-04
Open decisions for the owner: MCP calling the shared layer in-process instead of through internal REST (ADR 0001), and the write-only friction-report exception (C-9).
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
  comments, labels and an activity log, fit for any workflow. Every admin of a
  workspace's Clerk organization acts as its owner.
- **Agent-native:** agents are first-class actors through an MCP server, every
  human and agent action is attributed, and agents report friction they hit.
- **One shared layer:** the UI and MCP share one authorization and domain layer.
  Whether MCP calls it directly in-process (proposed in ADR 0001) or through the
  internal REST API the owner originally asked for is pending the owner's
  confirmation. A public API is out of scope.
- **Templates:** each board starts from a template. The plain template has To do,
  Doing and Done, one general agent role and no list rules. The product template
  adds product management (below). Workflow rules are settings, never core code
  (ADR 0004).

Non-goals: public hosting, billing, agent deletes, answering questions inside
Cardigan, a separate analytics product, and replacing the supervisor agent's
backlog as the record of execution progress (ADR 0003).

## Product template

Each product workspace has one board from this template; Cardigan's own workspace
has one too. Two agents work outside Cardigan: a supervisor agent that executes
work from its own backlog (an external task list whose task ids are opaque strings)
and a PM agent that proposes and grooms work. An agent holds one token per
workspace it works in.

Lists: Proposed, Queued, In flight, Waiting on owner, Done. The PM agent proposes,
comments and tidies. Only the owner puts cards into Queued or orders it; Queued
order is the owner's priority order. The owner declines a proposal by moving it to
Done with the Declined label. The supervisor agent reflects progress. A Waiting on
owner card mirrors a question the supervisor agent asked the owner in their chat;
it is read-only, and the supervisor agent resolves it when the owner answers.

The friction flywheel:

1. **Evidence:** failed MCP calls are already in the activity log. A friction
   report adds what the server cannot see, such as a confusing or missing tool.
2. **Repeats:** a report becomes a card in the Friction list on Cardigan's board,
   keyed by a server-computed fingerprint; a new occurrence adds a comment to that
   card, so counts and first and last seen come from its activity.
3. **Triage:** on a cadence set in the PM agent's own instructions, the PM agent
   turns repeated or high-impact friction cards into proposals with a measurable
   hypothesis, on the affected product's board or Cardigan's. The owner decides.
4. **Close the loop:** links are references in comments (card URL or backlog task
   id), so nothing reads across workspaces. The supervisor agent comments when the
   fix ships; at the next triage the PM agent comments the recurrence since.

## Success

From the activity log: card cycle time on plain boards; on product boards,
proposal-to-decision time and the share of proposals queued versus declined; MCP
tool error rate from failed-call entries. From the Friction list: reports filed,
repeated and resolved, and recurrence after a fix. Targets wait for a baseline.

## Acceptance criteria: core

The repo has no test framework yet; the first implementation PR adds one, and each
criterion becomes a test except deployment checks, which are recorded by hand.

- **C-1 Agent tokens:** the owner creates a token for one agent with one of the
  workspace's agent roles; it is shown once and stored only as a hash. Except for
  C-9, calls act only in its workspace: other workspaces' ids return not found.
  After revocation the next call fails as unauthorized. Both events are logged.
- **C-2 MCP tools:** discover boards and lists; list and search cards; get a card
  with comments, labels, activity and provenance (creating actor, surface, external
  key, source reference); create, update, move and comment on cards; link a
  duplicate to its canonical card; read changes; report friction. Results are
  paginated and errors typed. Creates and comments are retry-safe by external key;
  an update or move based on a stale card version is rejected.
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
- **C-8 Rules from settings:** a list's entry (create or move in), reorder, exit and
  locked-card settings come from its template, are shown in workspace settings, and
  are enforced for every actor in the UI and MCP. On a plain-template board any
  member or agent may create in and move cards to any list.
- **C-9 Friction reports:** as a narrow, write-only exception to C-1 (pending the
  owner's confirmation), any token can report friction onto Cardigan's Friction
  list. The receipt holds only the report key and whether it was new or a repeat,
  never a card id. The same report key adds nothing; the same fingerprint with a
  new report key adds exactly one comment.
- **C-10 Private mode:** with private mode on and no Stripe or Unsplash keys, the
  app builds and runs; no billing page, upgrade prompt or board cap appears, Stripe
  is never called, and boards get a default background. Deployment check: access
  from the private network succeeds and access from outside it fails.
- **C-11 Workspaces:** Clerk sign-in and organization switching keep working, and a
  person sees only boards in workspaces they belong to.

## Acceptance criteria: product template

- **P-1 Setup:** a board created from the product template has the five lists, the
  Declined label, the PM and supervisor roles and the rules below, all visible as
  settings. Cardigan's board also has the Friction list.
- **P-2 Queue authority:** only the owner may create a card in, move a card into, or
  reorder Queued, through any entry point; other people and all agents are denied.
- **P-3 Role split:** PM tokens may create cards only in Proposed, and may update,
  link duplicates and comment on unlocked cards. Among agents, only supervisor
  tokens move Queued cards to In flight and In flight cards to Done, and create or
  resolve Waiting on owner cards, using the backlog task id as the external key.
  The owner may make any move except on a locked card.
- **P-4 Owner-call cards:** Waiting on owner cards say to answer in chat and reject
  every edit, move or delete except the supervisor's resolve, which moves the card
  to Done with a comment referencing the answer.
- **P-5 Approval visible:** after the owner queues a proposal, the changes query
  returns that move attributed to the owner.
- **P-6 Flywheel:** triage of a repeated friction card produces one proposal whose
  comment references it, and after the fix ships the recurrence is commented.
