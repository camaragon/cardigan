# Card assignees are optional display names

Status: accepted for implementation; schema migration requires owner approval
before merge. Amends the assignee representation in
[ADR 0005](0005-card-claims-and-owner-answers.md) and PRD A-2.

## Context

Workspaces need to assign cards to people or agents before member and token
references are available in the editor. ADR 0005 and PRD A-2 specify a person
member or agent token; implementing those references now would require identity
selection and lifecycle behavior beyond the requested card fields.

## Decision

Store an optional free-text assignee, trimmed to at most 80 characters. Empty
text clears it. It is a display name, not an identity, permission or claim.
Edits use the existing card update capability, observed version and atomic
audit transaction. Claims remain separate and are outside this change.

Expose priority, assignee and blocked-by ids with titles in compact MCP reads
and get-card; update-card accepts optional fields without changing existing
callers. Blocked-by is a replacement set of same-workspace card ids. Reject
self-links and cycles, serializing dependency edits per workspace to preserve
that invariant under concurrency. Deleting either endpoint cascades its links.

## Consequences

Assignment works for names without membership or tokens. Names can be ambiguous
or become stale; they grant no authority. Linking assignees to workspace members
or tokens can be designed later without coupling assignment to a claim lease.
Priority order is `none < low < medium < high`; existing cards default to `none`.
Board position remains independently controlled by drag and drop.
