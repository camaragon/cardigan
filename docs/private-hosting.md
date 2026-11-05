# Private hosting

Implements [ADR 0002](adr/0002-private-deployment.md). Infrastructure and cutover
are administrator tasks; this repository does not provision them.

## Configuration and startup

Use Node.js 20.9+ and an administrator-provisioned local PostgreSQL database and
role. Set `DATABASE_URL` and `DIRECT_URL` to that same database in `.env.local`.
Set `PRIVATE_MODE=true` **before building**. Next.js embeds this nonsecret boolean
in both server and browser bundles; rebuild and restart to change modes. It defaults
to false. Never put credentials in Next.js's `env` configuration.

Keep Clerk publishable/secret keys, sign-in URLs and organization support enabled.
Set `NEXT_PUBLIC_APP_URL` to the private application origin. The host needs outbound
Clerk access. Verify the production Clerk domain requirement; if necessary use an
owned domain with private DNS pointing at the private host. Restrict sign-up to the
owner's intended users in Clerk and verify it before cutover.

Omit `STRIPE_API_KEY` and `STRIPE_WEBHOOK_SECRET` in private mode. Checkout and portal
server actions are blocked, `/api/webhook` returns 404, and no Stripe client is
constructed. Billing pages, tier badges, upgrade prompts and board caps are hidden.
Billing code and tables remain. Board counts keep tracking usage for a later mode
change. `NEXT_PUBLIC_UNSPLASH_ACCESS_KEY` is optional in every mode; without it the
picker uses bundled backgrounds and board creation defaults to one.

### Agent access (MCP)

The MCP endpoint at `/api/mcp` ([ADR 0001](adr/0001-agent-access-through-mcp.md))
returns 404 unless `MCP_ENABLED=true`. Turn it on only after the cutover checks
below show the app is reachable from the private network alone: the route skips
Clerk session protection and relies on agent tokens. The owner creates and
revokes tokens on a workspace's Agents page; an agent sends its token as
`Authorization: Bearer <token>` over Streamable HTTP.

```sh
npm ci
npm run schema:generate
npm run schema:deploy
npm run build
npm run start -- --hostname 127.0.0.1
```

Serve through an administrator-managed private-network proxy, or bind only to the
private interface. Do not expose the app or database on a public interface.

## Existing databases and migration baseline

The baseline `00000000000000_baseline` reflects the existing Prisma schema,
including billing tables. For a **new empty database**, `schema:deploy` creates it.
For an **existing database**, first back it up and compare its schema with
`prisma/schema.prisma`; reconcile drift before recording the baseline. Do not run
the baseline SQL against tables that already exist. Once verified, record it:

```sh
npx dotenv -e .env.local -- npx prisma migrate resolve --applied 00000000000000_baseline
npm run schema:deploy
```

Use committed migrations and `schema:deploy` thereafter, rather than `db push`.
`schema:reset` destroys data and is only for disposable development databases.

## Cutover record (administrator completes)

- [ ] Disable the existing hosted project's public deployments and branch previews
  before any agent-facing route is merged. Do not alter that service from this slice.
- [ ] Inspect the existing hosted database for data worth retaining. If needed,
  export with `pg_dump`, restore locally and verify counts before retiring it.
- [ ] Verify access from an authorized private-network device, and failure from
  outside the private network; verify no public deployment remains.
- [ ] Verify private Clerk sign-in, organization switching and workspace isolation
  with intended and unauthorized users.
- [ ] Schedule local backups with `pg_dump`; protect credentials and backup files.
  Restore one backup into a separate scratch database and verify representative
  boards, lists and cards. Record date, backup identifier and restore result.
- [ ] Run without Stripe/Unsplash keys: create more than five boards, inspect the
  bundled background, check billing URL and webhook return 404, and confirm no
  upgrade prompt or tier badge appears.

Record deployment evidence privately with the administrator. These checks remain
unverified until actual cutover; a successful build does not prove network isolation
or a working backup.
