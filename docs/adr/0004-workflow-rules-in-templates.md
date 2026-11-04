# Workflow rules live in workspace templates and settings

Status: proposed

## Context

Cardigan stays a general task board ([PRD](../product/prd.md)): the same core serves
product work, admin and client to-dos. Product management needs rules a plain board
must not have: only the owner approves work into a queue, approved work cannot be
rewritten behind the owner's back, owner questions are read-only, and agent roles
differ in what they may do. Hard-coding those rules would make every workspace a
product board; leaving them out would make the product workflow unenforceable.

## Decision

The core data model knows nothing about proposals or queues. It stores four kinds
of rule setting that the domain layer ([ADR 0001](0001-agent-access-through-mcp.md))
checks on every call:

- **Agent roles** per workspace: a name and capabilities drawn from the core tools
  (create, update, move, comment, link duplicates). Each agent token has one role.
- **List rules:** who may enter the list (create a card in it or move one into it),
  who may edit cards in it, who may reorder it, and, per target list, who may move
  cards from it to that target. "Who" is the owner, any member, or named agent
  roles. A board's template sets the default for a list with no rule: open on the
  plain template, owner only on the product template.
- **Locked cards:** a list can mark its cards locked. A locked card rejects edits,
  moves and deletes except a resolve (a move to Done with a comment) by the role
  allowed to resolve it, and the owner's logged force-resolve. It shows a configured
  notice, for example "Answer in chat".
- **Labels** seeded by the template, such as Declined and Resolved.

The owner is never limited by an agent-role capability, only by locks and by the
template's explicit rules below.

A template is seed data applied when a board is created: lists, list rules, labels,
and agent roles it adds to the workspace if missing. A workspace has at most one
board per template; agents find it by template key. The plain template has To do,
Doing and Done, open lists, and one "agent" role with every core capability.

Product template (default owner only). Who may act besides the owner:

| List | Enter | Edit | Exit |
|---|---|---|---|
| Proposed | PM, members | PM, members | to Done: members (decline); to Queued: owner only |
| Queued | owner only | owner only | to In flight: supervisor |
| In flight | from Queued only | owner only | to Done: supervisor |
| Waiting on owner | supervisor | locked | resolve to Done: supervisor |
| Done | from the exits above | owner only | owner only |

Reordering is owner only on every product list. Roles: PM may create, update,
comment and link duplicates; supervisor may create, move, comment and resolve. Any
role may comment on unlocked cards.

Friction intake (PRD C-9) is not a list rule. A server setting names Cardigan's own
workspace and board; setup adds a Friction list there, and the domain layer's
friction-report function is the only path that writes into it from another
workspace.

In this first slice settings are shown in workspace settings but fixed by the
template: changing a rule means changing the template and re-applying it. Agents
can never change settings. An owner editor comes with its own criterion when a real
workflow needs it.

Alternatives considered: hard-coded product lists and roles (rejected: the core must
stay general); a general automation or rules language (rejected: neither template
needs more than these four settings, and a language is harder to verify).

## Consequences

Lists gain rule settings and a template key; boards gain a template key unique per
workspace; workspaces gain agent roles; cards gain a locked state. These wait for
the migration baseline in [ADR 0002](0002-private-deployment.md). Product-template
tests run on a product board and core tests on a plain board, so neither depends on
the other. A workflow that needs a rule outside these four settings needs a new ADR.
