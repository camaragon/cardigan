# End-to-end journeys

Journeys live in `e2e/*.e2e.ts` and run with the open-source
[`e2e`](https://github.com/tester-army/e2e) framework on Playwright.
Configuration is in `e2e.config.ts` at the repo root.

They mix two kinds of steps:

- **Agent steps** (`agent.act`, `agent.assert`) for UI that is awkward to
  script, such as the board image picker and drag and drop. These need a model.
- **Deterministic steps** (`screen.getBy…`, `expect(…)`) for everything with
  stable labels, and to check the result of every agent step.

## Why they are skipped by default

Sign-in goes through Clerk, which needs a real (development) Clerk instance,
and agent steps need a model API key. Without the variables below, every
journey is reported as `skipped` and the run exits 0. They do not run in CI.

## What you need

1. **A Clerk development instance** (keys start with `pk_test_` / `sk_test_`).
   Production keys are refused: testing tokens only exist on development
   instances.
2. **A test user** in that instance who belongs to **an organization**.
   Note the user ID (`user_...`) and the organization's display name.
3. **The app's normal env** in `.env.local` (database, Clerk keys, Unsplash
   key), as for `npm run dev`. Use a development database.
4. **A model** for agent steps, through the AI SDK gateway: a model ID in
   `E2E_MODEL` (format `provider/model`, any model with tool calls and image
   input) and the key in `AI_GATEWAY_API_KEY`.

| Variable | Example | Used for |
| --- | --- | --- |
| `CLERK_SECRET_KEY` | `sk_test_...` | Testing token + sign-in token (Clerk Backend API) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` | The app itself |
| `E2E_CLERK_USER_ID` | `user_...` | The user to sign in as |
| `E2E_CLERK_ORG_NAME` | `E2E Org` | Organization picked on `/select-org` |
| `E2E_MODEL` | `provider/model-id` | Agent steps |
| `AI_GATEWAY_API_KEY` | | Agent steps |
| `APP_URL` | `http://localhost:3000` | Optional; defaults to localhost:3000 |

Never commit these values. Keep them in your shell or an untracked file.

## How sign-in works

`e2e/clerk.ts` uses the Clerk Backend API, so no password is typed into the
UI:

1. It requests a **testing token** and appends it to every Clerk Frontend API
   request, so bot protection does not block the automated browser.
2. It creates a single-use **sign-in token** for `E2E_CLERK_USER_ID` and opens
   `/sign-in?__clerk_ticket=<token>`, which the `<SignIn />` component redeems.
3. It picks the organization on `/select-org` and saves the browser session.
   Each journey restores that session.

## Run

```bash
set -a; source .env.local; set +a   # app env + the variables above
npm run test:e2e                     # starts `npm run dev` if nothing is on :3000
```

Results, traces and logs go to `.e2e/` (git-ignored). Disable telemetry with
`E2E_TELEMETRY_DISABLED=1`.

## Running in CI later

Add the variables above as repository secrets, then add a job that runs
`npm ci`, `npx @e2e-dev/web install chromium --with-deps` and `npm run test:e2e`
with those secrets in its env, and uploads `.e2e/`. Secrets are not passed to
pull requests from forks, so run it on `push` or for trusted branches only.
