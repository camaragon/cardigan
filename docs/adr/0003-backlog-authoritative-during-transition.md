# The supervisor's backlog stays authoritative for execution during transition

Status: proposed

## Context

The supervisor agent already executes work from its own backlog, which records
which tasks are running, blocked or done. Boards using Cardigan's product template
([PRD](../product/prd.md), [ADR 0004](0004-workflow-rules-in-templates.md)) are
about to hold the same products' proposals and the owner's priority order. If both
systems claim the same facts, agents will act on whichever they read last. A
two-way sync would need its own conflict resolution, retries and tests, which this
slice does not include. "Transition" here means the period until Cardigan, rather
than the backlog, records execution state.

## Decision

On product-template boards, split ownership by fact, not by product:

- **Cardigan owns proposals and order.** Whether a proposal exists, its text and
  comments, whether the owner has queued it, and the order of Queued live only in
  Cardigan. The supervisor agent reads Queued and its order directly as
  authoritative. It uses the changes query to learn of the owner's queue moves
  and other actors' changes across all lists without re-listing every board, which
  is also how approval becomes visible to agents (PRD P-5).
- **The backlog owns execution state.** Whether queued work is in progress,
  blocked or done, and which worker holds it, live only in the supervisor's
  backlog. The supervisor agent references the Cardigan card id in its backlog task
  and may comment progress links and move the card to In flight and Done, but those
  are reflections, not the record.

When the two disagree, Cardigan wins on what was asked and in what order, and the
backlog wins on what happened. There is no system sync in either direction; the
supervisor agent mirrors execution state onto the board with no delivery or timing
guarantee. Plain-template boards are not covered: there the board is the only record.

Alternatives considered: making Cardigan authoritative for execution now (rejected:
the supervisor agent's execution flow would have to change before the MCP tools are
proven); a two-way sync (rejected: see Context).

## Consequences

The owner approves and orders work in one place, and the supervisor agent keeps
its execution flow. In flight and Done may lag the backlog; that is accepted during
transition. Moving execution state into Cardigan later is a new decision that
supersedes this ADR, taken when failed MCP calls stay below a threshold the owner
sets from the Success baseline.
