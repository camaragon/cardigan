import { OrgControl } from "./_components/org-control";
import { auth, clerkClient } from "@clerk/nextjs/server";

// Generates the org name in the tab along with the app name
export const generateMetadata = async () => {
  const { orgId } = await auth();
  const organization = orgId
    ? await (await clerkClient()).organizations.getOrganization({
        organizationId: orgId,
      })
    : null;

  return {
    title: organization?.name ?? "Workspace",
  };
};

const OrganizationIdLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <OrgControl />
      {children}
    </>
  );
};

export default OrganizationIdLayout;
