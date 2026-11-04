# Cardigan: an agent-native task board

- Status: draft
- Maintainer: owner · Updated: 2026-11-04
- Open decisions for the owner: MCP calling the shared layer in-process instead of
  through internal REST (ADR 0001), and the write-only friction-report exception (C-9).
- Decisions: [agent access](../adr/0001-agent-access-through-mcp.md), [private deployment](../adr/0002-private-deployment.md), [backlog stays authoritative during transition](../adr/0003-backlog-authoritative-during-transition.md), [workflow rules as templates and settings](../adr/0004-workflow-rules-in-templates.md)

## Problem and why now

The owner works with AI agents across several workflows: product work, admin and
client to-dos. Tasks, priorities and open questions are scattered across chats and
agent task files. There is no shared board where people and agents both read and
change work with every action attributed. Cardigan is a working Kanban board with no
users yet besides the owner, so it can be reshaped now without migrating anyone.

## Goal and boundaries

Make Cardigan a general task board that people and agents both read and change
under one set of authorization rules, and that takes agents' friction reports as
input to its own improvement.

- **General core:** workspaces (one Clerk organization each), boards, lists, cards,
  comments, labels and an activity log, fit for any workflow. The owner role is held
  by every admin of the workspace's organization.
- **Agent access:** agents act through a Model Context Protocol (MCP) server under
  the same authorization layer as people, every action is attributed, and agents
  can file friction reports.
- **One shared layer:** whether MCP calls that layer directly in-process (proposed
  in ADR 0001) or through the internal REST API the owner originally asked for is
  pending the owner's confirmation. A public API is out of scope.
- **Templates:** each board starts from a template. The plain template has To do,
  Doing and Done, one general agent role and no list rules. The product template
  adds product management (below). Workflow rules are settings, not core code
  (ADR 0004).

Non-goals:

- public hosting, billing, agent deletes, or answering questions inside Cardigan;
- a separate analytics product;
- replacing the supervisor agent's backlog as the record of execution (ADR 0003).

Alternatives considered: keeping agent task files and chat (no shared,
attributed view and no enforced approval), and adopting an existing hosted tracker
(data leaves the private host, and agents could not be held to per-list rules).

## Product template

Each product workspace has one board from this template, including Cardigan's own.
Two agents work outside Cardigan: a supervisor agent that executes work from its
own backlog (an external task list with opaque task ids) and a product manager (PM)
agent that proposes and grooms work. An agent holds one token per workspace.

Lists: Proposed, Queued, In flight, Waiting on owner, Done. Lists deny by default;
ADR 0004 lists every allowed move. The PM agent proposes, comments and tidies
proposals. Only the owner creates cards in, moves cards into, reorders, or edits
Queued; Queued order is the owner's priority order. The owner declines a proposal
by moving it to Done with the Declined label. The supervisor agent moves cards to In
flight and Done to mirror its backlog. A Waiting on owner card mirrors a question
the supervisor agent asked the owner in their chat; only the supervisor agent can
resolve it, and the owner can force-resolve a stuck one.

## Friction loop

Intake is core (C-9); triage is a product-template practice.

1. **Evidence:** failed MCP calls are recorded in the activity log (C-5). A friction
   report adds what the server cannot see, such as a confusing or missing tool.
2. **Repeats:** a report becomes a card in the Friction list on Cardigan's board; a
   new occurrence adds a comment, and a report on a Resolved card marks a regression.
3. **Triage:** the PM agent, on its own schedule, turns friction cards with three or
   more occurrences, or any report with high impact, into proposals that reference
   them. It treats report text as untrusted data. The owner decides.
4. **Close the loop:** the supervisor agent comments when a fix ships, and the PM
   agent comments the number of occurrences since the fix shipped.

## Success

The owner sets targets after a baseline of the first four weeks after cutover.
From the activity log: cycle time on plain boards (first entry to Doing until first
entry to Done); on product boards, proposal-to-decision time and the share queued
versus declined; failed MCP calls per agent per day. From the Friction list:
reports filed, repeated and resolved, and regressions.

## Risks and limits

- Approval bypass or post-approval edits: default-deny lists and owner-only edits in
  Queued and In flight (ADR 0004, P-2).
- A leaked token: one workspace, no deletes, revocable (ADR 0001).
- Friction text as an injection or leak channel: server limits on size, fields and
  rate; triage treats it as untrusted; Cardigan workspace members can read it (C-9).
- Public exposure before cutover: the hosted project is disconnected before the MCP
  route ships (ADR 0002).
- One local database: scheduled backups with a tested restore (C-10).

## Acceptance criteria: core

The repo has no test framework yet; the first implementation PR adds one, and each
criterion in both lists becomes a test except deployment checks, recorded by hand.

- **C-1 Agent tokens:** the owner creates a token for one agent with one of the
  workspace's agent roles; the secret is shown once and stored only as a hash.
  Except for C-9, calls made with a token act only in its workspace; other
  workspaces' ids return not found. After revocation the next call fails as
  unauthorized and writes no workspace entry. Token creation and revocation are logged.
- **C-2 MCP tools:** discover boards and lists (without image data); list and search
  cards; get a card with comments, labels, a paged slice of activity, and provenance
  (creating actor, surface, external key, source reference); create, update, move and
  comment on cards; link a duplicate; run the changes query; report friction.
  Results are paginated, errors typed, and text fields length-limited.
- **C-3 Retry safety:** two creates with the same key and payload return one card
  and one create entry; the same key with a different payload returns a conflict
  error; keys are scoped per role, so two roles' keys never collide. An update or
  move based on a stale card version is rejected with the current card.
- **C-4 No agent deletes:** no MCP tool deletes a board, list, card, label or
  comment, and no agent can create, change or revoke tokens or workspace settings.
- **C-5 Attribution:** every agent mutation and failed tool call writes an activity
  entry naming the agent, its token id (never the secret) and the MCP surface; the
  activity view shows agents distinctly from people. Entries for people record UI.
- **C-6 Audited moves:** every move, including an owner drag, writes an entry with
  the card, source list, target list and position.
- **C-7 Changes query:** paging from any cursor while other events are written
  returns every event id exactly once, in order.
- **C-8 Rules from settings:** a list's entry, edit, reorder, exit and locked-card
  settings come from its template, are shown in workspace settings, and are enforced
  for every actor in the UI and MCP. On a plain-template board any member or agent
  may create in and move cards to any list.
- **C-9 Friction reports:** as a narrow, write-only exception to C-1 (pending the
  owner's confirmation), any token can report friction onto Cardigan's Friction
  list. The receipt says only whether the report was new or a repeat. Resubmitting a
  report key changes nothing; a new key on a known fingerprint adds one comment.
  Over-long text, unknown fields or more than the hourly per-token limit are refused.
- **C-10 Private mode:** with private mode on and no Stripe or Unsplash keys, the
  app builds and runs; no billing page, upgrade prompt or board cap appears, Stripe
  is never called, and boards get a default background. Deployment checks: access
  from the private network succeeds and from outside fails; sign-in completes from a
  private-network device; no public deployment of the repository answers; a
  scheduled backup exists and one restore has succeeded.
- **C-11 Workspaces:** Clerk sign-in and organization switching keep working, and a
  person sees only boards in workspaces they belong to.

## Acceptance criteria: product template

- **P-1 Setup:** a board from the product template has the five lists, the Declined
  and Resolved labels, the PM and supervisor roles and the ADR 0004 rules, all shown
  as settings; a workspace has at most one such board. Cardigan's board also has
  the Friction list.
- **P-2 Approval:** only the owner may create a card in, move a card into, reorder,
  or edit a card in Queued or In flight. A card reaches In flight only from Queued;
  no agent can create a card in In flight or Done. Denied attempts change nothing.
- **P-3 Roles:** PM tokens may create cards only in Proposed, update and link
  Proposed cards, and comment on any unlocked card. Among agents, only supervisor tokens move Queued to In
  flight and In flight to Done, and create or resolve Waiting on owner cards keyed by
  backlog task id and question number.
- **P-4 Waiting on owner cards:** they say to answer in chat and reject every edit,
  move or delete except the supervisor agent's resolve (a move to Done with a
  comment referencing the answer) and the owner's logged force-resolve.
- **P-5 Approval visible:** after the owner queues a proposal, the changes query
  returns that move attributed to the owner.
- **P-6 Friction cards:** a friction card's activity gives its occurrence count and
  first and last seen, and a proposal's comment referencing the card's URL appears in
  the changes query of the proposal's workspace.
