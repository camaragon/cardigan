/**
 * Clerk sign-in for e2e journeys, with no password typed into the UI.
 *
 * Uses the Clerk Backend API of a *development* instance:
 *  - a testing token, appended to Frontend API requests, so bot protection
 *    does not block the automated browser;
 *  - a one-time sign-in token for an existing test user, redeemed by the
 *    <SignIn /> page through the `__clerk_ticket` query parameter.
 *
 * Required env (see e2e/README.md): CLERK_SECRET_KEY (sk_test_...),
 * E2E_CLERK_USER_ID, E2E_CLERK_ORG_NAME.
 */
import type { Browser } from "@e2e-dev/web";

const CLERK_API = "https://api.clerk.com/v1";

export const clerkEnv = {
  secretKey: process.env.CLERK_SECRET_KEY ?? "",
  userId: process.env.E2E_CLERK_USER_ID ?? "",
  orgName: process.env.E2E_CLERK_ORG_NAME ?? "",
};

const hasModel = Boolean(process.env.E2E_MODEL);

/** Why journeys must skip, or null when everything they need is set. */
export const skipReason: string | null = !clerkEnv.secretKey.startsWith("sk_test_")
  ? "CLERK_SECRET_KEY for a Clerk development instance (sk_test_...) is not set"
  : !clerkEnv.userId || !clerkEnv.orgName
    ? "E2E_CLERK_USER_ID and E2E_CLERK_ORG_NAME are not set"
    : !hasModel
      ? "E2E_MODEL is not set (agent steps need a model)"
      : null;

async function clerkPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${CLERK_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clerkEnv.secretKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Clerk ${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

/** Appends a fresh testing token to every Clerk Frontend API request. */
export async function useClerkTestingToken(browser: Browser) {
  const { token } = await clerkPost<{ token: string }>("/testing_tokens");

  await browser.route(/\.clerk\.accounts\.dev\/v1\//, async (route) => {
    const url = new URL(route.request.url);
    url.searchParams.set("__clerk_testing_token", token);
    await route.continue({ url: url.toString() });
  });
}

/** A single-use URL that signs the test user in when opened. */
export async function signInPath() {
  const { token } = await clerkPost<{ token: string }>("/sign_in_tokens", {
    user_id: clerkEnv.userId,
    expires_in_seconds: 300,
  });
  return `/sign-in?__clerk_ticket=${encodeURIComponent(token)}`;
}
