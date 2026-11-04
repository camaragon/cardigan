# Run privately on the tailnet with local Postgres and billing dormant

## Context

The owner and their agents are the only users, and public hosting is a later
decision. The code assumes a public SaaS: Stripe checkout and a public webhook
(`lib/stripe.ts`, `app/api/webhook`), a five-board free cap (`constants/boards.ts`,
`lib/org-limit.ts`), and an Unsplash client that throws at import without its key
(`lib/unsplash.ts`). The schema is applied with `prisma db push` and has no
migrations. The owner believes an earlier hosted deployment may exist. The repo
hints at one but does not prove it: the README says Vercel, `.vercel` is gitignored,
and `prisma/schema.prisma` uses a `DATABASE_URL` and `DIRECT_URL` pair, the usual
pooled and direct split for a hosted Postgres such as Supabase.

## Decision

Serve Cardigan only on the owner's tailnet, from the owner's private host. The host
administrator provisions a local PostgreSQL database and its credentials; the app
never creates databases or roles. `DATABASE_URL` and `DIRECT_URL` both point at it.

Add one private-mode setting, on for this deployment. In private mode the billing
page, upgrade prompts and board cap are off, the Stripe client is never constructed
and the webhook route returns not found. Billing code and tables stay in place and
come back when the setting is off. Unsplash becomes optional in every mode: without
a key, board creation uses a default background instead of failing at import.

Keep Clerk for sign-in and workspaces. The Clerk instance must allow the tailnet URL,
and the host needs outbound access to Clerk.

Before cutover, the owner checks for an existing deployment (a Vercel project and a
hosted database such as Supabase). If one holds data worth keeping, export it with
`pg_dump` and restore it into the local database; then retire the hosted copy.

Move from `prisma db push` to `prisma migrate`. Generate a baseline migration from
the current schema, mark it applied on any existing database with
`prisma migrate resolve --applied`, and apply later changes with
`prisma migrate deploy`. The ADR 0001 schema additions start after the baseline.

## Consequences

The app is unreachable from the internet, so Stripe could not deliver webhooks
anyway; the webhook's exception in `proxy.ts` stays but is unused while private
mode is on. Agents reach the MCP route over the
tailnet with their tokens. Backups of the local database become the host
administrator's job. Public hosting later means turning private mode off, choosing
a host, and revisiting billing; this ADR does not cover that. The existing
`schema:reset` script already calls `prisma migrate reset`, which only becomes
meaningful once migrations exist.
