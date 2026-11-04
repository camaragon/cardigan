# Cardigan: an agent-native task board

- Status: approved
- Approval record: owner, 2026-11-04
- Maintainer: owner · Updated: 2026-11-04
- Decided by the owner: direct shared domain functions for the UI and MCP, no internal REST layer for now ([ADR 0001](../adr/0001-agent-access-through-mcp.md)); a write-only suggestion box for friction reports (C-9).
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
  labels, an activity log, and new card comments, fit for any workflow. The owner
  role is held by every admin of the workspace's organization.
- **Agent access:** agents act through a Model Context Protocol (MCP) server under
  the same authorization layer as people (ADR 0001); every action is attributed;
  agents can file friction reports. A public API is out of scope.
- **Templates:** each board starts from a template. The plain template has To do,
  Doing and Done, one general agent role and no list rules. The product template
  adds product management. Workflow rules are settings, not core code (ADR 0004).

Non-goals:

- public hosting, billing, agent deletes, or answering questions inside Cardigan;
- a separate analytics product;
- replacing the supervisor agent's backlog as the record of execution (ADR 0003).

## Product template

Two agents work outside Cardigan: a supervisor agent that executes work from its own
backlog (an external task list with opaque task ids) and a product manager (PM)
agent that proposes and grooms work. An agent holds one token per workspace. A
product board has Proposed, Queued, In flight, Waiting on owner and Done; lists deny
by default and ADR 0004 lists every allowed move. Queued order is the owner's
priority order. Waiting on owner cards mirror questions the supervisor agent asked
the owner in chat.

## Suggestion box

Agents file friction (a confusing or missing tool, or anything else the server cannot
see) into a Suggestion box list on Cardigan's own board; failed calls are already recorded
(C-5). A new occurrence adds a comment to the same card. Triage into proposals is the
PM agent's practice, outside Cardigan; the owner decides what is queued.

## Success

The owner sets targets after a baseline of the first four weeks after cutover.
From the activity log: cycle time on plain boards (first entry to Doing until first
entry to Done); on product boards, proposal-to-decision time and the share queued
versus declined; failed MCP calls per agent per day; friction reports filed,
repeated, and occurring again after a fix shipped. Risks and their mitigations are
in the Consequences of ADRs 0001, 0002 and 0004.

## Acceptance criteria: core

The repo has no test framework yet; the first implementation PR adds one, and each
criterion becomes a test except deployment checks, which are recorded by hand.

- **C-1 Agent tokens:** the owner creates a token for one agent with one of the
  workspace's agent roles; the secret is shown once and stored only as a hash.
  Except for C-9, calls made with a token act only in its workspace; other
  workspaces' ids return not found. After revocation the next call fails as
  unauthorized and writes no entry. Token creation and revocation are logged.
- **C-2 MCP tools:** discover boards and lists; list and search cards; get a card;
  create, update, move and comment on cards; mark a duplicate; run the changes
  query; report friction. Results are paginated, errors typed, and text
  length-limited (details in ADR 0001).
- **C-3 Retry safety:** two creates with the same key and payload return one card
  and one create entry; the same key with a different payload returns a conflict
  error; two roles' keys never collide. An update or move based on a stale card
  version is rejected with the current card.
- **C-4 No agent deletes:** no MCP tool deletes a board, list, card, label or
  comment, and no agent can create, change or revoke tokens or workspace settings.
- **C-5 Attribution:** every agent mutation and failed tool call writes an activity
  entry naming the agent, its token id (never the secret) and the MCP surface. The
  activity view and card comments show agents distinctly from people; entries for
  people record UI.
- **C-6 Audited moves:** every move, including an owner drag, writes an entry with
  the card, source list, target list and position.
- **C-7 Changes query:** paging from any cursor while other events are written
  returns every event id exactly once, in order.
- **C-8 Rules from settings:** a list's entry, edit, reorder and exit settings and
  its notice come from its template, are shown in workspace settings, and are
  enforced for every actor in the UI and MCP. On a plain-template board any member
  or agent may create in and move cards to any list.
- **C-9 Suggestion box:** as a narrow, write-only exception to C-1, any product
  workspace's agent token can file a friction report into Cardigan's Suggestion box
  list and learns only whether it was new or a repeat; it cannot read there. Resubmitting a report key changes
  nothing; reports beyond ADR 0001's size, field and rate limits are refused.
- **C-10 Private mode:** with private mode on and no Stripe or Unsplash keys, the
  app builds and runs; no billing page, upgrade prompt or board cap appears, Stripe
  is never called, and boards get a default background. ADR 0002's cutover checks
  (private-network access only, private sign-in, no public deployment, a backup with
  one tested restore) are recorded by hand.
- **C-11 Workspaces:** Clerk sign-in and organization switching keep working, and a
  person sees only boards in workspaces they belong to.

## Acceptance criteria: product template

- **P-1 Setup:** a board from the product template has the five lists, the Declined
  label, the PM and supervisor roles and the ADR 0004 rules, all shown as settings;
  a workspace has at most one product board. Cardigan's board also has the
  Suggestion box list.
- **P-2 Approval:** only the owner may create a card in, move a card into, reorder,
  or edit a card in Queued or In flight. A card reaches In flight only from Queued;
  no agent can create a card in In flight or Done. Denied attempts change no card or
  list.
- **P-3 Roles:** PM tokens may create cards only in Proposed, update and mark
  duplicates among Proposed cards, and comment on any card. Among agents, only
  supervisor tokens move Queued to In flight and In flight to Done, and create or
  edit Waiting on owner cards keyed by backlog task id and question number.
- **P-4 Waiting on owner:** the list shows a notice to answer in chat; only the
  supervisor agent creates or edits its cards; the supervisor agent or the owner
  moves them to Done.
- **P-5 Approval visible:** after the owner queues a proposal, the changes query
  returns that move attributed to the owner.
