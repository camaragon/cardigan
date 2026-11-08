# Board templates are starting points, not workflow rules

Status: proposed. Supersedes [ADR 0004](0004-workflow-rules-in-templates.md).
Amends [ADR 0001](0001-agent-access-through-mcp.md),
[ADR 0003](0003-backlog-authoritative-during-transition.md) and
[ADR 0005](0005-card-claims-and-owner-answers.md).

## Context

ADR 0004 made a template the carrier of an enforced workflow: per-list rules that
deny by default, fixed list keys that rules name as move targets, agent roles each
template adds, and at most one product board per workspace. The owner has since
decided that Cardigan stays a generic task board and that templates are optional
starting points for a kind of work, after which a board is fully customizable
([board templates PRD](../product/board-templates.md)). Enforced rules and fixed
keys conflict with that: deleting or renaming a list a rule names would break the
rule, and every board would carry a second, hidden model of its own workflow.

This changes who may move and approve work, so it needs an ADR.

## Decision

- A template is code-defined seed data: lists in order, labels and an optional
  board notice. It is applied once, when a person creates a board, in the same
  transaction as the board create. After that the board is ordinary.
- The board keeps its template key as a record of origin. Nothing authorizes,
  queries or behaves on it, so it can be dropped later without a migration of
  behavior.
- There are no list rules, list notices, list keys, template roles or per-template
  board limits. Authorization stays as on `main`: the workspace scope, the agent
  role's capabilities, ADR 0001's "agents never delete and never manage tokens or
  settings", and ADR 0005's claims and owner-only answers.
- Agents discover a board's shape from the describe tool, never from template
  list names.
- The suggestion box (ADR 0001) no longer depends on a product board: any
  workspace's agent token may file a friction report, and it stays write-only and
  limited as ADR 0001 says. A server setting names the target list by id, so it
  needs no list key or rule.

ADR 0005 changes only where it named the product template: claiming is a
capability of the workspace's agent role; the "Waiting on owner" list and its
notice no longer exist; an open question is found by its question state, not by
its list. ADR 0003's split (Cardigan owns what was asked and its order, the
backlog owns execution state) applies to whichever board the supervisor agent
works from, regardless of template.

Alternatives considered: keeping ADR 0004's rules as optional template settings
(rejected for now: no workflow has needed enforcement yet, and rules tied to
template list keys break when people customize lists); templates as database rows
the owner edits (rejected: one owner and a handful of templates do not need an
editor; code constants are reviewed and tested like any other change); no stored
template key (rejected narrowly: it costs one column and lets the describe tool and
activity reports say where a board came from).

## Consequences

Boards gain a template key and a notice; lists and workspaces gain nothing. The
domain layer has no rule engine, so the UI and MCP keep one simple permission
check. Risk: without rules, an agent can move work into a "ready" list or
straight to Done. Every move is attributed in the activity log and the changes
query, so an agent that must act only on owner approval checks that the move it
reacts to was made by the owner (as PRD P-5 did). If misuse happens in practice, an
optional per-list rule that people set on any board can be added under a new ADR,
independent of templates. ADR 0004 stays as history.
