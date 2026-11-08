import { expect, it, vi } from "vitest";

const { auth, getOrganization } = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrganization: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth,
  clerkClient: vi.fn(async () => ({
    organizations: { getOrganization },
  })),
}));

vi.mock(
  "@/app/(platform)/(dashboard)/organization/[organizationId]/_components/org-control",
  () => ({ OrgControl: () => null }),
);

import { generateMetadata } from "@/app/(platform)/(dashboard)/organization/[organizationId]/layout";

it("uses the stored workspace name verbatim and falls back without an active organization", async () => {
  auth.mockResolvedValue({ orgId: "org_demo", orgSlug: "demo-llc" });
  getOrganization.mockResolvedValue({ name: "Demo LLC" });

  await expect(generateMetadata()).resolves.toEqual({ title: "Demo LLC" });
  expect(getOrganization).toHaveBeenCalledWith({ organizationId: "org_demo" });

  getOrganization.mockClear();
  auth.mockResolvedValue({ orgId: null });

  await expect(generateMetadata()).resolves.toEqual({ title: "Workspace" });
  expect(getOrganization).not.toHaveBeenCalled();
});
