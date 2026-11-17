import { db } from "@/lib/db";
import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { Actor, isAgent, requirePerson } from "./actor";
import { transaction, writeAudit } from "./audit";
import { KeyPrefix } from "@/lib/card-key";
import { reservePrefix } from "./card-keys";
import { lockBoardOrder } from "./ordering";
import { DomainError } from "./errors";
import { BoardTemplate, BoardTemplateKey, TEMPLATES } from "./templates";

export interface CreateBoardInput {
  title: string;
  template?: BoardTemplateKey;
  keyPrefix?: string;
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

  const parsed = KeyPrefix.optional().safeParse(input.keyPrefix);
  if (!parsed.success) throw new DomainError("invalid", parsed.error.issues[0].message);
  const prefix = parsed.data;
  return transaction(async (tx) => {
    const board = await tx.board.create({
      data: {
        orgId: actor.orgId,
        title: input.title,
        template: template.key,
        keyPrefix: prefix,
        notice: template.notice ?? null,
        ...input.image,
      },
    });
    if (prefix) await reservePrefix(tx, actor.orgId, board.id, prefix);
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
        keyPrefix: true,
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

export const updateBoard = async (actor: Actor, input: { id: string; title?: string; image?: string; notice?: string; keyPrefix?: string }) => {
  requirePerson(actor);
  const { id, title, image, notice } = input;
  const parsed = KeyPrefix.optional().safeParse(input.keyPrefix);
  if (!parsed.success) throw new DomainError("invalid", parsed.error.issues[0].message);
  const prefix = parsed.data;
  // Build update data object
  const updateData: {
    title?: string;
    notice?: string | null;
    imageId?: string;
    imageThumbUrl?: string;
    imageFullUrl?: string;
    imageLinkHTML?: string;
    imageUserName?: string;
  } = {};

  if (notice !== undefined) updateData.notice = notice || null;

  if (title) {
    updateData.title = title;
  }

  if (image) {
    const [imageId, imageThumbUrl, imageFullUrl, imageLinkHTML, imageUserName] =
      image.split("|");

    if (imageId === "uploaded") {
      // For uploaded images, use the data URL as both thumb and full URL
      updateData.imageId = `uploaded-${Date.now()}`;
      updateData.imageThumbUrl = imageThumbUrl;
      updateData.imageFullUrl = imageFullUrl;
      updateData.imageLinkHTML = "";
      updateData.imageUserName = "Custom Upload";
    } else {
      // For Unsplash images, validate all fields are present
      if (
        !imageId ||
        !imageThumbUrl ||
        !imageFullUrl ||
        !imageLinkHTML ||
        !imageUserName
      ) {
        throw new DomainError("invalid", "Missing image fields. Failed to update board");
      }
      updateData.imageId = imageId;
      updateData.imageThumbUrl = imageThumbUrl;
      updateData.imageFullUrl = imageFullUrl;
      updateData.imageLinkHTML = imageLinkHTML;
      updateData.imageUserName = imageUserName;
    }
  }

  return transaction(async (tx) => {
    await lockBoardOrder(tx, id);
    const previous = await tx.board.findUniqueOrThrow({ where: { id, orgId: actor.orgId } });
    if (prefix !== undefined && prefix !== previous.keyPrefix) {
      await reservePrefix(tx, actor.orgId, id, prefix);
      if (!previous.keyPrefix) {
        // Lock the selected cards before numbering so concurrent deletes cannot leave gaps.
        const count = await tx.$executeRaw`
          WITH cards AS MATERIALIZED (
            SELECT c.id, c."createdAt" FROM "Card" c
            JOIN "List" l ON l.id = c."listId"
            WHERE l."boardId" = ${id}
            FOR UPDATE OF c
          ), numbered AS (
            SELECT id, row_number() OVER (ORDER BY "createdAt", id)::integer AS number
            FROM cards
          )
          UPDATE "Card" c SET "number" = n.number
          FROM numbered n WHERE c.id = n.id
        `;
        await tx.board.update({ where: { id }, data: { nextCardNumber: count + 1 } });
      }
    }
    const board = await tx.board.update({ where: { id, orgId: actor.orgId }, data: { ...updateData, keyPrefix: prefix } });
    await writeAudit(tx, actor, { action: ACTION.UPDATE, entityType: ENTITY_TYPE.BOARD, entityId: board.id, entityTitle: board.title });
    return board;
  });
};
