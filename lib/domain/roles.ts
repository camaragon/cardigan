import { db } from "@/lib/db";
import { Tx } from "./audit";

/** Role key to display name, for rule descriptions and denials. */
export const roleNames = async (tx: Tx | typeof db, orgId: string) => {
  const roles = await tx.agentRole.findMany({ where: { orgId } });
  return Object.fromEntries(roles.map((r) => [r.key, r.name]));
};
