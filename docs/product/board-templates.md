# Board templates: optional starting points

- Status: draft
- Maintainer: owner · Updated: 2026-11-08
- Refs: issue #45. Decision: [ADR 0006](../adr/0006-templates-are-starting-points.md),
  which supersedes [ADR 0004](../adr/0004-workflow-rules-in-templates.md) and
  amends ADRs 0001, 0003 and 0005.
- Replaces the product template, C-8 and P-1 to P-5 in the [main PRD](prd.md).

## Problem

Cardigan is a general task board that people and agents share. Some kinds of work
have a well-known shape, such as product work moving from a backlog through review
to acceptance, and setting those lists up by hand on every board is tedious. The
earlier plan (ADR 0004) solved this with an enforced product workflow: fixed list
keys, deny-by-default list rules, template-specific agent roles and one product
board per workspace. That turns Cardigan into a workflow engine for one process.
The owner wants the opposite: a generic board, with templates as a quick start.

## Goals and non-goals

Goals:

- Create a board from a template in one step, or from no template as today.
- After creation the board is ordinary: every list and label can be renamed,
  reordered, added or deleted, and nothing breaks.
- Agents work on a templated board exactly as on any other board.
- Adding a template later is adding data, not code paths.

Non-goals:

- Enforced workflow: list rules, approval gates, required lists or transitions.
- Template-specific agent roles or a limit on boards per template.
- Keeping boards in sync with a template after creation, or re-applying one.
- Templates that people or agents create or edit in the app.

## Template model

A template is a constant in code: a key, a name, a one-line description, an
ordered list of list titles, labels (name and color) and an optional board notice.
Creating a board from a template creates the board, its lists in order and any
labels the workspace lacks (labels are per workspace, matched by name), in one
transaction with one audited board create. The board stores the template key it
came from as a record of origin only; no rule, query or permission reads it.

The create-board form offers Blank (today's empty board, the default) and Product
management. The board notice is short guidance on how work flows; it is shown on
the board and returned by the describe tool, and people can edit or clear it.

## Product management template

| Lists, in order | Labels | Board notice |
|---|---|---|
| Backlog, To Do, In Progress, In Review, Ready For Acceptance, Done | Feature, Bug, Chore | "Work moves left to right. In Review is for review of finished work; Ready For Acceptance waits for the owner to accept and move it to Done." |

The notice describes a convention. It is not enforced: any person or agent who
may move cards may move them to any list, and every move is in the activity log.

## Customization guarantees

On any board, whatever its template, people can rename, reorder, add, copy and
delete lists, edit labels and the board notice, and delete the board, with the
same actions and results as on a blank board. Nothing in Cardigan depends on a
templated list's title, position or existence. Changing a template in code never
changes existing boards.

## Agents and MCP

The describe tool returns each board's lists in order, its labels, its notice and
its template key, so an agent learns a board's shape by reading it, not from
the template's list names, which people may rename or delete. Agents keep the workspace agent role and its capabilities; templates add
no roles and no rules. Agents cannot create boards or edit notices.

## Acceptance criteria

- **T-1 Seeding:** creating a board from Product management gives exactly the six
  lists in the order above, the three labels and the notice; creating it twice in
  one workspace gives two boards and no duplicate labels.
- **T-2 Blank:** creating a board with no template gives an empty board, as before
  templates.
- **T-3 Atomic:** board creation from a template is one transaction: if any part
  fails, no board, list or label is left behind; on success one board-create
  activity entry is written.
- **T-4 Customizable:** on a Product management board, renaming, reordering,
  adding, copying and deleting any list (including In Review and Done) succeeds
  as on a blank board, and cards can then be created in and moved between the
  remaining lists.
- **T-5 No enforced flow:** an agent token with the move capability can move a
  card from any list to any other list on a Product management board, and the
  move is attributed in the activity log; no list denies it.
- **T-6 Describe:** the describe tool returns, for a templated board, its lists in
  current order (after renames), its labels, its notice and its template key.
- **T-7 Notice:** people can edit and clear the board notice; an agent cannot
  change it.
- **T-8 Limits:** the free board limit counts templated boards like any other
  board; no template has its own limit.

## Open questions

1. **Should any list rule survive, for example Done owner-only on Product
   management?** Recommended: no. Ship with no rules; every move is attributed,
   so an agent that needs owner approval checks who made the move. If agents
   misuse a list in practice, add one optional per-list rule that
   people set on any board, under its own ADR, rather than a template setting.
2. **Should there also be a To do, Doing, Done template?** Recommended: not yet.
   Blank plus one template proves the model; adding one is a data change.
3. **Should the board notice exist in the first slice?** Recommended: yes. It is
   the one place an agent learns how a board is meant to be used, and A-4 already
   requires it; list notices are dropped.
4. **Who may file friction reports now that product boards are gone?**
   Recommended: any workspace's agent token, still write-only and under ADR 0001's
   size, field and rate limits.

## How the open PRs fit

- **#11 (templates and list rules): change.** Keep the template constants, the
  transactional `createBoard` and the `template` and `notice` board columns.
  Replace the plain and product templates with Blank and Product management. Drop
  `rules.ts`, the list `rules` and `templateKey` columns, list notices, `enforce`
  in cards and comments (back to the capability check on `main`), template roles,
  the singleton check and its advisory lock, and the product-rule tests. Replace
  those tests with T-1 to T-5.
- **#17 (suggestion box): keep, with a small change.** It is not about templates;
  it only borrows #11's list helper and product-board check. Remove the
  product-board gate (open question 4), and replace `SUGGESTION_BOX_BOARD_ID` and
  the keyed, rule-carrying list it creates with a `SUGGESTION_BOX_LIST_ID` setting
  naming an ordinary list the owner creates. Rebase onto `main` so it no longer
  waits on #11.
- **#24 (picker, notices, rules table): change.** Keep the template picker with
  the two new options and the board notice. Drop list notices, the rules table on
  the Agents page and the narrowed upgrade prompt, which existed only for the
  second-product-board refusal.
