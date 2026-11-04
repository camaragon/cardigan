import { beforeEach, describe, expect, it, vi } from "vitest";
import { clerkState, resetClerk } from "../setup/mock-clerk";

// No database: every path here returns or throws before touching Prisma.
vi.mock("@clerk/nextjs/server", async () =>
  (await import("../setup/mock-clerk")).clerkServerMock,
);

const orgLimit = await import("@/lib/org-limit");

describe("org-limit without an active organization", () => {
  beforeEach(() => {
    resetClerk();
    clerkState.orgId = null;
  });

  it.each([
    "incrementAvailableCount",
    "decrementAvailableCount",
    "hasAvailableCount",
  ] as const)("%s throws Unauthorized", async (fn) => {
    await expect(orgLimit[fn]()).rejects.toThrow("Unauthorized");
  });

  it("getAvailableCount returns 0", async () => {
    await expect(orgLimit.getAvailableCount()).resolves.toBe(0);
  });
});
