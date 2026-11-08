import { db } from "@/lib/db";
import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { Actor, isAgent } from "./actor";
import { transaction, writeAudit } from "./audit";
import { DomainError } from "./errors";
import { BoardTemplate, BoardTemplateKey, TEMPLATES } from "./templates";

export interface CreateBoardInput {
  title: string;
  template?: BoardTemplateKey;
  image: {
    imageId: string;
    imageThumbUrl: string;
    imageFullUrl: string;
    imageUserName: string;
    imageLinkHTML: string;
  };
}

/** Seeds an ordinary, editable board once, with one audited transaction. */
export const createBoard = async (actor: Actor, input: CreateBoardInput) => {
  if (isAgent(actor)) {
    throw new DomainError("denied", "Agents cannot create boards", {
      rule: "workspace.settings",
      allowed: ["people"],
      alternative: "Ask the owner to create the board.",
    });
  }
  const template: BoardTemplate = TEMPLATES[input.template ?? "blank"];
  if (!template) throw new DomainError("invalid", "Unknown board template");

  return transaction(async (tx) => {
    const board = await tx.board.create({
      data: {
        orgId: actor.orgId,
        title: input.title,
        template: template.key,
        notice: template.notice ?? null,
        ...input.image,
      },
    });
    // The workspace audit lock also serializes label seeding across creates.
    await writeAudit(tx, actor, {
      action: ACTION.CREATE,
      entityType: ENTITY_TYPE.BOARD,
      entityId: board.id,
      entityTitle: board.title,
    });
    for (const [index, title] of template.lists.entries()) {
      await tx.list.create({ data: { boardId: board.id, title, order: index + 1 } });
    }
    for (const label of template.labels) {
      const existing = await tx.label.findFirst({
        where: { orgId: actor.orgId, name: label.name },
      });
      if (!existing) {
        await tx.label.create({ data: { ...label, orgId: actor.orgId } });
      }
    }
    return board;
  });
};

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
        template: true,
        notice: true,
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
