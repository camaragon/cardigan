# Workflow rules live in workspace templates and settings

## Context

Cardigan stays a general task board ([PRD](../product/prd.md)): the same core serves
product work, admin and client to-dos. Product management needs rules a plain board
must not have: only the owner approves work into a queue, owner-call cards are
read-only, and agent roles differ in what they may do. Hard-coding those rules
would make every workspace a product board; leaving them out would make the
product workflow unenforceable for agents.

## Decision

The core data model knows nothing about proposals or queues. It stores three kinds
of rule setting that the domain layer ([ADR 0001](0001-agent-access-through-mcp.md))
checks on every call:

- **Agent roles** per workspace: a name and a set of capabilities drawn from the
  core tool list (create, update, move, comment, link duplicates, resolve locked
  cards). Each agent token carries one role.
- **List rules:** who may enter the list (create a card in it or move a card into
  it), who may reorder it, and, per target list, who may move cards from it to that
  target. "Who" is the owner, any member, or named agent roles. No rule means anyone in the
  workspace. The owner may make any move except on a locked card.
- **Locked cards:** a list can mark its cards locked. A locked card rejects edits,
  moves and deletes from everyone except the role that may resolve it, and shows a
  configured notice (for example "Answer in chat").

A template is seed data applied when a board is created: its lists, list rules and
labels, plus agent roles it adds to the workspace if they are missing. Agents find a
board by its template key. Two ship first. The plain template has To do, Doing and
Done, no list rules, and one "agent" role with every core capability. The product
template adds a Declined label and is:

| Criterion | Setting that enforces it |
|---|---|
| P-2 owner-only Queued | Queued: entry and reorder limited to the owner |
| P-3 PM creates in Proposed | Proposed: entry open to the PM role; every other list's entry excludes it |
| P-3 supervisor reflects progress | Queued: exit to In flight limited to the supervisor; In flight: exit to Done limited to the supervisor |
| P-3, P-4 owner-call cards | Waiting on owner: entry limited to the supervisor, cards locked, resolvable by the supervisor (a move to Done with a comment), notice "Answer in chat" |

Friction intake (PRD C-9) is not a list rule. A server setting names Cardigan's own
workspace and board; setup adds a Friction list there, and the domain layer's
friction-report function is the only path that writes into it from another
workspace.

In this first slice settings are shown in workspace settings but fixed by the
template: changing a rule means changing the template and re-applying it. Agents
can never change settings. An editor for the owner comes with its own criterion
when a real workflow needs it.

Alternatives considered: hard-coded product lists and roles (rejected: the core
must stay general); a general automation or rules language (rejected: no workflow
needs more than these three settings, and a language is harder to verify).

## Consequences

Lists gain rule settings and an optional template key so agents find lists by
purpose rather than title; workspaces gain agent roles; cards gain a locked state.
These wait for the migration baseline in [ADR 0002](0002-private-deployment.md).
Product-management tests run against a board built from the product template, and
core tests run against a plain board, so neither depends on the other. A new
workflow is a new template, not new code, unless it needs a rule outside these
three settings; that needs a new ADR.
