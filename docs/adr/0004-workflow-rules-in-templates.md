# Workflow rules live in workspace templates and settings

## Context

Cardigan stays a general task board ([PRD](../product/prd.md)): the same core serves
product work, admin and client to-dos. Product management needs rules a plain board
must not have: only the owner approves work into a queue, owner-call cards are
read-only, and agent roles differ in what they may do. Hard-coding those rules
would make every workspace a product board; leaving them out would make the
product workflow unenforceable for agents.

## Decision

The core data model knows nothing about proposals or queues. It stores a small,
fixed set of rule settings that the domain layer ([ADR 0001](0001-agent-access-through-mcp.md))
checks on every call:

- **Agent roles** per workspace: a name and a set of capabilities drawn from the
  core tool list (for example create, update, move, comment, resolve locked cards).
  Each agent token carries one role.
- **List rules:** who may move a card into the list, who may reorder it, and which
  roles may move cards out of it to which lists. "Who" is the owner, any member, or
  named agent roles. No rule means anyone in the workspace.
- **Locked cards:** a list can mark its cards locked. A locked card rejects edits,
  moves and deletes from everyone except the role that may resolve it, and shows a
  configured notice (for example "Answer in chat").

A template is seed data: a set of lists, rule settings and agent roles applied when
a board or workspace is created. Two ship first. The plain template has To do,
Doing and Done with no rules. The product template has Proposed, Queued, In flight,
Waiting on owner and Done; Queued accepts and reorders only by the owner; PM and
supervisor roles; supervisor alone moves Queued to In flight and Done; Waiting on
owner cards are locked and resolvable by the supervisor. After creation the owner
may change the settings; agents never can. Every change is logged.

Alternatives considered: hard-coded product lists and roles (rejected: the core
must stay general); a general automation or rules language (rejected: no workflow
needs more than the three settings above, and a language is harder to verify).

## Consequences

Lists gain rule settings and an optional template key so agents find lists by
purpose rather than title; workspaces gain agent roles; cards gain a locked state.
These wait for the migration baseline in [ADR 0002](0002-private-deployment.md).
Product-management tests run against a board built from the product template, and
core tests run against a plain board, so neither depends on the other. A new
workflow is a new template, not new code, unless it needs a rule outside these
three settings; that would need a new ADR.
