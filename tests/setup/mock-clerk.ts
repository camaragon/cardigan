import { vi } from "vitest";

/**
 * Shared state for the Clerk server mock. Tests set `clerkState.orgId` /
 * `clerkState.userId` to control what `auth()` returns.
 *
 * Usage in a test file (vi.mock is hoisted, so import the state inside it):
 *
 *   vi.mock("@clerk/nextjs/server", async () =>
 *     (await import("../setup/mock-clerk")).clerkServerMock);
 */
export const clerkState: {
  userId: string | null;
  orgId: string | null;
  orgRole: string | null;
} = {
  userId: "user_test",
  orgId: "org_test",
  orgRole: "org:admin",
};

export const clerkServerMock = {
  auth: vi.fn(async () => ({
    userId: clerkState.userId,
    orgId: clerkState.orgId,
    orgRole: clerkState.orgRole,
  })),
  currentUser: vi.fn(async () =>
    clerkState.userId
      ? {
          id: clerkState.userId,
          firstName: "Test",
          lastName: "User",
          imageUrl: "https://example.test/avatar.png",
        }
      : null,
  ),
};

export function resetClerk() {
  clerkState.userId = "user_test";
  clerkState.orgId = "org_test";
  clerkState.orgRole = "org:admin";
}
