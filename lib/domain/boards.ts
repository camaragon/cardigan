import { db } from "@/lib/db";
import { Actor } from "./actor";

/**
 * Everything an agent needs to cold-start on a workspace (PRD S-1): boards
 * without image fields, their lists, labels, and the caller's own role and
 * capabilities.
 */
export const describeWorkspace = async (actor: Actor) => {
  const [boards, labels] = await Promise.all([
    db.board.findMany({
      where: { orgId: actor.orgId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        lists: {
          orderBy: { order: "asc" },
          select: { id: true, title: true },
        },
      },
    }),
    db.label.findMany({
      where: { orgId: actor.orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);
  return {
    workspaceId: actor.orgId,
    you: {
      name: actor.name,
      kind: actor.kind,
      role: actor.role?.name ?? null,
      capabilities: actor.role?.capabilities ?? [],
    },
    boards,
    labels,
  };
};
