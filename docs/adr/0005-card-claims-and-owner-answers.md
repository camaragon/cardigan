# Card claims coordinate agents, and only the owner answers questions

Status: accepted. The owner approved PRD amendments A-1 and A-2 on 2026-11-04;
this ADR records the authority rules they need.
Amended by [ADR 0006](0006-templates-are-starting-points.md): there is no
product template, so the claim capability belongs to the workspace's agent role
and the Waiting on owner list and its notice are gone.

## Context

The [PRD](../product/prd.md) now lets agents claim a card with a lease so two
agents never work the same card (A-2), and lets a card carry an open question that
the owner answers in the app (A-1). Both change who may do what to a card, which
[ADR 0001](0001-agent-access-through-mcp.md) and
[ADR 0004](0004-workflow-rules-in-templates.md) define: a claim can block other
actors, and an answer is how the owner tells agents a decision. Left open, a claim
could become a way for one agent to lock the owner out, and an agent could write
an answer that looks like the owner's.

## Decision

**Claims.** A claim is a lease on one card held by one actor, with an expiry. The
domain layer claims with a single conditional write: it succeeds when the card has
no claim, the claim has expired, or the caller already holds it (a renewal);
otherwise it fails with a conflict naming the holder and expiry. The caller asks
for a lease length, which the server bounds by a default and a maximum. The holder
may release; the owner may release any claim. Expiry is evaluated when read, so an
expired claim counts as none and writes no event; the next claim's entry records
what it replaced.

- Claiming is a capability drawn from the core tools, like move or comment. The
  plain template's agent role has it; on the product template only the supervisor
  role has it.
- A claim is not a card edit: it does not change the card version and is allowed
  wherever the actor may see the card, even in lists whose edit rule excludes it.
- While a card is claimed, updates and moves by any other agent are refused with a
  denial naming the holder and expiry. Comments are never blocked, and people are
  never blocked by an agent's claim, so a claim cannot lock the owner out.
  Claims add a refusal; they never grant anything list rules deny.
- Claim, renewal and release are audited mutations that appear in the changes
  query, attributed like every other mutation.
- The assignee is a separate card field, edited under the list's edit rule. A
  claim does not change it.

On product-template boards, [ADR 0003](0003-backlog-authoritative-during-transition.md)
still holds: the supervisor's backlog owns which worker holds queued work, and a
claim in Cardigan is the supervisor's reflection of it, used to keep agents from
colliding, not a second record.

**Answers.** A question is a field on the card with a state, open or answered, set
by anyone who may edit the card. An answer is a card comment of kind `answer` that
references the question and closes it. Only the owner may write one, and only in
the UI; the MCP surface cannot create `answer` comments for any role. The answer
reaches agents as a comment event in the changes query attributed to the owner.
On the product template, the Waiting on owner list's notice changes from "Answer in chat"
to telling the owner to answer on the card; its list rules are unchanged.

Alternatives considered: claims as advisory only, enforced by agents' own
discipline (rejected: two agents with stale reads would still collide, which is
the problem A-2 exists to solve); claims that also block people (rejected: an
agent that crashes holding a long lease would lock the owner out of their own
board); a separate question entity with its own rules (rejected: a comment kind
reuses comment storage, attribution and the changes query); letting agents relay
answers the owner gave in chat (rejected: an agent could then fabricate an owner
decision; the owner can still paste a chat answer into the app).

## Consequences

Cards gain an assignee (person or agent token), claim holder and lease expiry, an
open question with its state, due date, priority, parent, blocked-by and external
references; comments gain a kind. A revoked token keeps its claims until they
expire or the owner releases them, and stays visible as an assignee. ADR 0004's
settings gain a capability (claim) and a board notice; the notice is guidance, not
a rule, so it adds no enforcement. Risks: an agent can hold a card for up to the
maximum lease, bounded by the owner's release; a question-and-answer path inside
Cardigan means the owner must look at the board, which the Success metric for
time-to-answer tracks.
