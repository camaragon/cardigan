# Board card keys with stable numbers and prefix aliases

Status: accepted.

## Context

People and agents need short references such as DEMO-12. Board titles, card
positions and list names change, so none can supply a stable number. Templates
remain starting points under [ADR 0006](0006-templates-are-starting-points.md).

## Decision

A board optionally has a current key prefix and a next-number counter. A card
stores its number; reads derive its key from the current board prefix. All create
paths reserve numbers by atomically incrementing that counter in the card's
transaction, under the existing board ordering lock. Copies get new numbers.
Deletion never frees numbers. Moves remain restricted to lists on the same board.

Workspace members can enable or rename prefixes in board settings; agents cannot.
Prefixes use 2–10 uppercase letters or digits, starting with a letter. Current and
previous prefixes occupy one unique namespace per workspace. Renaming retains an
alias, so old keys still resolve; a board can switch back to its own alias. Keys
cannot be disabled after enabling. Prefix changes write an attributed board audit
entry. Enabling numbers existing cards by createdAt then id in one transaction.

The product management creation form prompts for a prefix; all subsequent behavior
depends on the board setting, regardless of template. Card reads expose the current
key, and search and MCP card references accept current and historical keys within
the caller's workspace. Internal ids and URLs stay unchanged.

## Consequences

An additive migration adds nullable board prefixes and card numbers, a board
counter, and a prefix registry. Existing boards remain unchanged until enabled.
No per-workspace counter or card rewrite is needed when renaming a prefix. Old
prefixes remain reserved while their board exists. A board deletion removes its
prefix registry along with its cards. Cross-board moves would require a separate
identity decision before they could be supported.
