# The supervisor's backlog stays authoritative for execution during transition

## Context

The supervisor agent already executes work from its own backlog, which records
which tasks are running, blocked or done. Cardigan is about to hold the same
products' proposals and the owner's priority order ([PRD](../product/prd.md)). If
both systems claim the same facts, agents will act on whichever they read last, and
a two-way sync would be a second product before the first one works.

## Decision

Split ownership by fact, not by product:

- **Cardigan owns proposals and order.** Whether a proposal exists, its text and
  comments, whether the owner has queued it, and the Queue's order live only in
  Cardigan. The supervisor agent reads them through the changed-since query.
- **The backlog owns execution state.** Whether queued work is in progress,
  blocked or done, and which worker holds it, live only in the supervisor's
  backlog. The supervisor references the Cardigan card id in its backlog task and
  may comment progress links and move the card to Done, but those are reflections,
  not the record.

When the two disagree, Cardigan wins on what was asked and in what order, and the
backlog wins on what happened. There is no automatic sync in either direction.

## Consequences

The owner approves and orders work in one place, and the supervisor agent keeps
its existing execution flow. Board status beyond the Queue may lag the backlog;
that is accepted during transition. Moving execution state into Cardigan later is
a new decision that supersedes this ADR, once the MCP tools have proven reliable
in daily use.
