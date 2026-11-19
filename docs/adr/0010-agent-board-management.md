# Agents can create and delete boards within their workspace

Status: accepted. Supersedes the board authority restrictions in
[ADR 0001](0001-agent-access-through-mcp.md) and
[ADR 0006](0006-templates-are-starting-points.md); amends
[ADR 0009](0009-board-card-keys.md) for prefixes at creation.

## Context

Agents cannot start work in a new board without a person first creating its
lists. The owner requested board creation and deletion for all general agents,
while retaining restricted roles and destructive-action safeguards.

## Decision

Add `manage_boards` to the general Agent role. A data migration appends it to
existing roles with the built-in `agent` key; other roles keep their capabilities.
Domain functions check the capability, actor workspace and audit attribution.

`create_board` takes a title, optional template, optional ordered `listTitles`
replacing the template's lists, optional key prefix, and required retry-safe
`externalKey`. It reuses template labels and notice and a bundled background.
It returns the board id and list ids/titles. Replays follow existing external-key
semantics; deleted boards are not recreated by replaying their keys.

`delete_board` requires the board id and `confirmation` equal to its current
title, without trimming or case folding. It serializes with board renames and
uses the existing hard delete and cascade, with an agent-attributed audit entry
in the same transaction. People retain their existing create and delete paths.
Agents still cannot edit existing boards or lists, delete individual cards,
lists, labels or comments, or manage tokens and workspace settings.

## Consequences

Agents can seed work without a person setting up a board. A token with this
capability can destroy an entire board and its contents; title confirmation
prevents accidental target selection, not misuse of an authorized token.
Narrower roles remain the way to withhold both operations. No schema change,
new role system or separate list-management tools are needed.
