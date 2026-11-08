# Continue bounded card reads through MCP

Status: accepted.

## Context

`get_card` returns the oldest 50 comments with no continuation. Its activity
cursor compares event ids while its ordering compares timestamps, so a page can
skip events when transaction timestamps differ from commit order.

## Decision

Keep the existing `comments` array and default page size and order. Add optional
`commentCursor` input and `commentNextCursor` (string or null) and
`commentHasMore` output. Callers pass the returned cursor unchanged to read the
next page. The opaque cursor contains the last comment's timestamp and id; both
fields order each page ascending, so tied timestamps are deterministic. Invalid
cursors return `invalid`. Each read remains scoped to the requested card and
workspace. Reads are live pages rather than a snapshot across calls.

Activity orders by descending event id, matching `activityBefore`. As with
`get_changes`, only sequenced successful events participate; historical rows
without event ids remain available through the existing UI log route. The last
actor in a stale-version error uses event order and excludes same-list reorders,
which do not change the version. Historical unsequenced rows are a fallback for
last actor only, ordered by timestamp and id.

## Consequences

Existing clients retain their first comment page and response arrays. Agents can
read later comments without an unbounded response or another tool. No schema,
authority or UI changes are required. Clients must treat comment cursors as
opaque and stop when `commentHasMore` is false.
