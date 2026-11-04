# Cardigan: an agent-native task board

- Status: approved
- Approval record: owner, 2026-11-04. Amendments A-1 to A-4, the build order and
  the agent surface principles: approved by the owner, 2026-11-04.
- Maintainer: owner · Updated: 2026-11-04
- Decided by the owner: direct shared domain functions for the UI and MCP, no internal REST layer for now ([ADR 0001](../adr/0001-agent-access-through-mcp.md)); a write-only suggestion box for friction reports (C-9).
- Decisions: [agent access](../adr/0001-agent-access-through-mcp.md), [private deployment](../adr/0002-private-deployment.md), [backlog stays authoritative during transition](../adr/0003-backlog-authoritative-during-transition.md), [workflow rules as templates and settings](../adr/0004-workflow-rules-in-templates.md), [card claims and owner answers](../adr/0005-card-claims-and-owner-answers.md)

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
- **Work queue:** cards carry an assignee, a claim with a lease, due date,
  priority, parent, blocked-by and external references, so a board works as a
  queue that several agents pull from without colliding (A-2, ADR 0005).
- **Questions in the app:** a card can carry an open question that the owner
  answers in Cardigan, and agents see the answer through the changes query (A-1).
- **Templates:** each board starts from a template. The plain template has To do,
  Doing and Done, one general agent role and no list rules. The product template
  adds product management. Workflow rules and board guidance are settings, not
  core code (ADR 0004).

Non-goals:

- public hosting, billing, or agent deletes;
- a separate analytics product;
- vector or semantic search;
- replacing the supervisor agent's backlog as the record of execution (ADR 0003).

## Product template

Two agents work outside Cardigan: a supervisor agent that executes work from its own
backlog (an external task list with opaque task ids) and a product manager (PM)
agent that proposes and grooms work. An agent holds one token per workspace. A
product board has Proposed, Queued, In flight, Waiting on owner and Done; lists deny
by default and ADR 0004 lists every allowed move. Queued order is the owner's
priority order. Waiting on owner holds cards with an open question for the owner,
who answers it in Cardigan (A-1).

## Suggestion box

Agents file friction (a confusing or missing tool, or anything else the server cannot
see) into a Suggestion box list on Cardigan's own board; failed calls are already recorded
(C-5). A new occurrence adds a comment to the same card. Triage into proposals is the
PM agent's practice, outside Cardigan; the owner decides what is queued.

## Agent surface principles

The MCP tools (C-2, ADR 0001) follow these principles; criteria S-1 to S-5 test
them.

- **Self-describing workspace:** one describe tool returns everything an agent needs
  to cold-start on any workspace with no per-project prompt: boards, lists with
  their rules and notices, the board notice, labels, and the agent's own role and
  capabilities.
- **Denials that teach:** a rule denial names the rule, who may perform the action,
  and an allowed alternative. The error is the onboarding.
- **Token-cheap reads:** list results are compact by default; get-card returns
  everything about one card in one call; board results omit image fields.
- **Batch creates:** one call creates several cards, each with its own external key,
  and returns a result per item, so a partial failure is legible.
- **One move primitive:** UI drags and agent moves use the same single-card move
  with a target list and position; bulk reorder is a client convenience over it.
- **Changes query as heartbeat:** agents poll the changes query rather than
  re-listing boards. A signed per-workspace webhook may later wake agents instead;
  it is a public interface and needs its own ADR.
- **Markdown in and out:** a markdown checklist imports into a list; a board or list
  exports to markdown, so the board can be pasted into prompts.
- **Search:** Postgres full-text search over card titles, descriptions and comments.

## Build order

Each step is one or two PRs and builds on the one before.

1. **Domain layer and actor model** (ADR 0001): shared domain functions with an
   explicit actor, audit entries in the same transaction, card versions, external
   keys, comments and the changes cursor; the UI keeps working unchanged (C-3, C-5
   to C-7, A-3).
2. **Agent tokens and a minimal MCP server on plain boards** (C-1, C-2, C-4, S-1 to
   S-4). The owner's agents use it daily for at least a week before step 4.
3. **Card structure and claims** (A-2, ADR 0005).
4. **Templates, list rules, agent roles and the suggestion box** (ADR 0004, C-8,
   C-9, P-1 to P-5, A-4).
5. **In-app questions and answers** (A-1), then webhooks, markdown import and export
   (S-5) and full-text search (S-6), in the order daily use demands.

## Success

The owner sets targets after a baseline of the first four weeks after cutover.
From the activity log: cycle time on plain boards (first entry to Doing until first
entry to Done); on product boards, proposal-to-decision time and the share queued
versus declined; failed MCP calls per agent per day; friction reports filed,
repeated, and occurring again after a fix shipped; time from a question being asked
to its answer. Risks and their mitigations are in the Consequences of ADRs 0001,
0002, 0004 and 0005.

## Acceptance criteria: core

Each criterion becomes a test in the Vitest suite except deployment checks, which
are recorded by hand.

- **C-1 Agent tokens:** the owner creates a token for one agent with one of the
  workspace's agent roles; the secret is shown once and stored only as a hash.
  Except for C-9, calls made with a token act only in its workspace; other
  workspaces' ids return not found. After revocation the next call fails as
  unauthorized and writes no entry. Token creation and revocation are logged.
- **C-2 MCP tools:** describe the workspace; list and search cards; get a card;
  create cards in a batch; update, move, claim, release and comment on cards; mark
  a duplicate; run the changes query; report friction. Results are paginated,
  errors typed, and text length-limited (details in ADR 0001).
- **C-3 Retry safety:** two creates with the same key and payload return one card
  and one create entry; the same key with a different payload returns a conflict
  error; two roles' keys never collide. An update or move based on a stale card
  version is rejected with the current card and its last actor.
- **C-4 No agent deletes:** no MCP tool deletes a board, list, card, label or
  comment, and no agent can create, change or revoke tokens or workspace settings.
- **C-5 Attribution:** every agent mutation and failed tool call writes an activity
  entry naming the agent, its token id (never the secret) and the MCP surface. The
  activity view and card comments show agents distinctly from people; entries for
  people record UI.
- **C-6 Audited moves:** every move, including an owner drag or a UI reorder, goes
  through the single-card move and writes an entry with the card, source list,
  target list and position.
- **C-7 Changes query:** paging from any cursor while other events are written
  returns every event id exactly once, in order.
- **C-8 Rules from settings:** a list's entry, edit, reorder and exit settings and
  its notice, and the board notice, come from the board's template, are shown in
  workspace settings, and are enforced for every actor in the UI and MCP. On a
  plain-template board any member or agent may create in and move cards to any list.
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

## Acceptance criteria: agent surface

- **S-1 Describe:** with a fresh token and no other input, the describe tool returns
  the workspace's boards, each board's notice, its lists with their rules and
  notices, its labels, and the calling agent's role and capabilities.
- **S-2 Denials that teach:** every rule denial returns a typed error naming the
  rule, the actors allowed to perform the action and at least one allowed
  alternative (for example: only the owner may move to Queued; comment on the card
  to request it).
- **S-3 Compact reads:** list and search results return only id, title, list,
  labels, assignee, claim holder, version and updated time unless more fields are
  requested; get-card returns description, labels, comments, references, claim,
  question, provenance and a paged slice of activity in one call.
- **S-4 Batch create:** a batch create of up to the server's batch limit returns one
  result per item in input order; an item that fails (for example, a key conflict)
  does not stop the others, and retrying the whole batch with the same keys creates
  no duplicates.
- **S-5 Markdown:** importing a markdown checklist into a list creates one card per
  item in order, under the importer's rules and attribution; exporting a board or
  list returns markdown with one item per card, its list and its title.
- **S-6 Search:** a search for a word that appears only in a card's comment finds
  that card, and results never include cards from another workspace.

## Acceptance criteria: amendments

Approved by the owner on 2026-11-04.

- **A-1 Questions answered in the app:** an actor allowed to edit a card can set an
  open question on it. Only the owner can answer it, in the app, as a comment of kind
  `answer` that closes the question; agents cannot write `answer` comments. The
  answer appears in the changes query attributed to the owner, and get-card shows
  the question with its answer. On the product template, Waiting on owner is the
  list that holds such cards.
- **A-2 Assignee, claims and card structure:** a card has an optional assignee, a
  person member or an agent token of the same workspace. A claim is atomic: when two
  agents claim the same unclaimed card at once, exactly one succeeds and the other
  gets a conflict naming the current holder and lease expiry. A holder may renew or
  release; an expired claim counts as no claim; the owner may release any claim.
  While a card is claimed, other agents' updates and moves on it are refused with
  the holder named; comments and people's actions are not blocked. Claim, renewal
  and release each write an audit entry and appear in the changes query. A card also
  has an optional due date, a priority (none, low, medium or high), a parent card,
  blocked-by cards and up to ten external references (an http or https URL plus a
  label); parent and blocked-by cards must be in the same workspace and may not form
  a cycle. ADR 0001's source reference is stored as one of these references.
- **A-3 Short text:** a title or description of one character is accepted for every
  actor, in the UI and MCP; an empty title is still rejected.
- **A-4 Board guidance:** each template supplies a short board notice describing how
  work flows on that board; it is shown on the board and returned by the describe
  tool. Agents cannot change it.

## Acceptance criteria: product template

- **P-1 Setup:** a board from the product template has the five lists, the Declined
  label, the PM and supervisor roles, the ADR 0004 rules and a board notice, all
  shown as settings; a workspace has at most one product board. Cardigan's board
  also has the Suggestion box list.
- **P-2 Approval:** only the owner may create a card in, move a card into, reorder,
  or edit a card in Queued or In flight. A card reaches In flight only from Queued;
  no agent can create a card in In flight or Done. Denied attempts change no card or
  list.
- **P-3 Roles:** PM tokens may create cards only in Proposed, update and mark
  duplicates among Proposed cards, and comment on any card. Among agents, only
  supervisor tokens move Queued to In flight and In flight to Done, claim cards,
  and create or edit Waiting on owner cards keyed by backlog task id and question
  number.
- **P-4 Waiting on owner:** the list's notice tells the owner to answer on the card;
  only the supervisor agent creates or edits its cards; the owner answers their
  questions in the app (A-1); the supervisor agent or the owner moves them to Done.
- **P-5 Approval visible:** after the owner queues a proposal, the changes query
  returns that move attributed to the owner.
