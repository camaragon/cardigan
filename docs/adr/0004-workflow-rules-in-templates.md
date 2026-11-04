# Workflow rules live in workspace templates and settings

Status: proposed

## Context

Cardigan stays a general task board ([PRD](../product/prd.md)): the same core serves
product work, admin and client to-dos. Product management needs rules a plain board
must not have: only the owner approves work into a queue, approved work cannot be
rewritten behind the owner's back, owner questions are mirrored read-only, and agent
roles differ in what they may do. Hard-coding those rules would make every workspace
a product board; leaving them out would make the product workflow unenforceable.

## Decision

The core data model knows nothing about proposals or queues. It stores three kinds
of setting that the domain layer ([ADR 0001](0001-agent-access-through-mcp.md))
checks on every call:

- **Agent roles** per workspace: a name and capabilities drawn from the core tools
  (create, update, move, comment, mark duplicates). Each agent token has one role.
- **List rules:** who may enter the list (create a card in it or move one into it),
  who may edit cards in it, who may reorder it, and, per target list, who may move
  cards from it to that target; plus an optional notice shown on the list. "Who" is
  the owner, any member, or named agent roles. A board's template sets the default
  for a list with no rule: open on the plain template, owner only on the product
  template.
- **Labels** seeded by the template, such as Declined.

A template is seed data applied when a board is created: lists, list rules, labels,
and agent roles it adds to the workspace if missing. Existing boards become
plain-template boards. Plain-template boards are unlimited; a workspace has at most
one product-template board, which agents find by its template key. The plain
template has To do, Doing and Done, open lists, and one "agent" role with every
core capability.

Product template, default owner only. Who may act, including the owner:

| List | Enter | Edit | Exit |
|---|---|---|---|
| Proposed | PM, members, owner | PM, members, owner | to Done (decline): members, owner; to Queued: owner |
| Queued | owner | owner | to In flight: supervisor, owner; to Proposed: owner |
| In flight | from Queued only | owner | to Done: supervisor, owner |
| Waiting on owner | supervisor | supervisor | to Done: supervisor, owner |
| Done | from the exits above | owner | owner |

Waiting on owner shows the notice "Answer in chat". Reordering is owner only on
every product list. Roles: PM may create, update, comment and mark duplicates;
supervisor may create, update, move and comment. Any role may comment on any card.

The suggestion box (PRD C-9) is not a list rule. A server setting names Cardigan's
own workspace and board; setup adds a Suggestion box list there, and the domain
layer's friction-report function is the only path that writes into it from another
workspace.

In this first slice settings are shown in workspace settings but fixed by the
template: changing a rule means changing the template and re-applying it. Agents
can never change settings. An owner editor comes with its own criterion when a real
workflow needs it.

Alternatives considered: hard-coded product lists and roles (rejected: the core must
stay general); a general automation or rules language (rejected: neither template
needs more than these three settings, and a language is harder to verify); locked
cards for owner questions (rejected: ordinary edit and exit rules give the same
result without a fourth setting).

## Consequences

Lists gain rule settings, a notice and a template key; boards gain a template key;
workspaces gain agent roles. These wait for the migration baseline in
[ADR 0002](0002-private-deployment.md). Product-template tests run on a product
board and core tests on a plain board, so neither depends on the other. The main
risk is a mis-seeded rule that opens an approval path; P-2's tests cover every
entry into Queued and In flight. A workflow that needs a rule outside these three
settings needs a new ADR.
