# The supervisor's backlog stays authoritative for execution during transition

## Context

The supervisor agent already executes work from its own backlog, which records
which tasks are running, blocked or done. Workspaces using Cardigan's product
template ([PRD](../product/prd.md), [ADR 0004](0004-workflow-rules-in-templates.md))
are about to hold the same products' proposals and the owner's priority order. If
both systems claim the same facts, agents will act on whichever they read last, and
a two-way sync would be a second product before the first one works.

## Decision

On product-template workspaces, split ownership by fact, not by product:

- **Cardigan owns proposals and order.** Whether a proposal exists, its text and
  comments, whether the owner has queued it, and the order of Queued live only in
  Cardigan. The supervisor agent reads Queued and its order directly as the
  truth, and uses the changes query to learn when to re-read.
- **The backlog owns execution state.** Whether queued work is in progress,
  blocked or done, and which worker holds it, live only in the supervisor's
  backlog. The supervisor references the Cardigan card id in its backlog task and
  may comment progress links and move the card to In flight and Done, but those
  are reflections, not the record.

When the two disagree, Cardigan wins on what was asked and in what order, and the
backlog wins on what happened. There is no system sync in either direction; the
supervisor mirrors execution state onto the board on a best-effort basis.
Workspaces on the plain template are not covered: there the board is the only
record.

## Consequences

The owner approves and orders work in one place, and the supervisor agent keeps
its existing execution flow. In flight and Done may lag the backlog; that is
accepted during transition. Moving execution state into Cardigan later is a new
decision that supersedes this ADR, once the MCP tools have proven reliable in
daily use.
