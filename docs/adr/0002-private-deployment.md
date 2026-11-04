# Run on a private network with local Postgres and billing dormant

Status: proposed

## Context

The owner and their agents are the only users, and public hosting is a later
decision. The code assumes a public SaaS: Stripe checkout and a public webhook
(`lib/stripe.ts`, `app/api/webhook`), a five-board free cap (`constants/boards.ts`,
`lib/org-limit.ts`), and an Unsplash client that throws at import without its key
(`lib/unsplash.ts`). The schema is applied with `prisma db push` and has no
migrations. A hosted project connected to this repository builds and publicly
serves branch previews; the README describes that hosting. `prisma/schema.prisma`
uses a `DATABASE_URL` and `DIRECT_URL` pair, the usual pooled and direct split for a
hosted Postgres provider. Nothing in the repository shows whether that database
still holds data.

## Decision

Serve Cardigan only on the owner's private network (a VPN that only the owner's
devices and agents join), from the owner's private host. The host administrator
(the owner or their delegate) provisions a local PostgreSQL database and its
credentials; the app never creates databases or roles. `DATABASE_URL` and
`DIRECT_URL` both point at it.

Add one private-mode setting, on for this deployment. In private mode the billing
page, upgrade prompts and board cap are off, the Stripe client is never constructed
and the webhook route returns not found. Billing code and tables stay and are active
again when the setting is off. Unsplash becomes optional in every mode: without a
key, board creation uses a default background instead of failing at import.

Keep Clerk for sign-in and workspaces. The host needs outbound access to Clerk.
Assumption to verify before cutover: a Clerk production instance may require a
domain the owner controls, which a private-network hostname may not satisfy. The
fallback is a domain the owner owns with private DNS pointing at the private host.

Order of work: the owner disconnects the hosted project, or at least turns off its
public deployments, before any PR that adds the MCP route merges, because that route
skips session protection and relies on its token alone. Before cutover the owner
checks the hosted project's environment for a hosted database; if it holds data
worth keeping, it is exported with `pg_dump` and restored locally, and the hosted
database is retired.

Move from `prisma db push` to `prisma migrate`: generate a baseline migration from
the current schema, mark it applied on any existing database with
`prisma migrate resolve --applied`, and apply later changes with
`prisma migrate deploy`. The schema additions in ADRs 0001 and 0004 follow it.

The host administrator schedules local database backups and tests one restore into
a scratch database before cutover.

Alternatives considered: staying on the hosted project behind sign-in (rejected:
branch previews are served publicly, and the MCP route would be internet-facing);
public hosting behind an access proxy (deferred with the public-hosting decision);
removing billing code instead of a dormant setting (rejected: the owner keeps it
for later).

## Consequences

The app is unreachable from the internet, so Stripe cannot deliver webhooks; the
webhook's exception in `proxy.ts` stays but is unused while private mode is on.
Agents reach the MCP route over the private network with their tokens. The local
database is the only system of record, so backups are a cutover precondition.
Public hosting later means turning private mode off, choosing a host, and revisiting
billing; this ADR does not cover that. The existing `schema:reset` script already
calls `prisma migrate reset`, which only becomes meaningful once migrations exist.
