import { ACTION, ENTITY_TYPE, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { Actor, isAgent } from "./actor";
import { transaction, Tx, writeAudit } from "./audit";
import { DomainError, notFound } from "./errors";
import { roleNames } from "./cards";
import { describeRules } from "./rules";
import { BoardTemplate, TemplateList, TEMPLATES } from "./templates";
import type { BoardTemplateKey } from "./rules";

/** Adds the template's agent roles to the workspace when missing. */
export const ensureRoles = async (
  tx: Tx,
  orgId: string,
  template: BoardTemplate,
) => {
  for (const role of template.roles) {
    await tx.agentRole.upsert({
      where: { orgId_key: { orgId, key: role.key } },
      update: {},
      create: {
        orgId,
        key: role.key,
        name: role.name,
        capabilities: role.capabilities,
      },
    });
  }
};

export const createTemplateList = (
  tx: Tx,
  boardId: string,
  list: TemplateList,
  order: number,
) =>
  tx.list.create({
    data: {
      boardId,
      title: list.title,
      order,
      templateKey: list.key,
      rules: list.rules ? (list.rules as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      notice: list.notice ?? null,
    },
  });

export interface CreateBoardInput {
  title: string;
  template: BoardTemplateKey;
  image: {
    imageId: string;
    imageThumbUrl: string;
    imageFullUrl: string;
    imageUserName: string;
    imageLinkHTML: string;
  };
}

/**
 * Creates a board from a template: its lists with their rules and notices,
 * its labels, and the agent roles it adds to the workspace (ADR 0004). A
 * workspace has at most one product board (PRD P-1).
 */
export const createBoard = async (actor: Actor, input: CreateBoardInput) => {
  if (isAgent(actor)) {
    throw new DomainError("denied", "Agents cannot create boards", {
      rule: "workspace.settings",
      allowed: ["people"],
      alternative: "Ask the owner to create the board.",
    });
  }
  const template = TEMPLATES[input.template];
  if (!template) throw new DomainError("invalid", "Unknown board template");

  return transaction(async (tx) => {
    if (template.singleton) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`template:${actor.orgId}:${template.key}`}))`;
      const existing = await tx.board.findFirst({
        where: { orgId: actor.orgId, template: template.key },
      });
      if (existing) {
        throw new DomainError(
          "conflict",
          `This workspace already has a ${template.name.toLowerCase()} board`,
          { existingBoardId: existing.id },
        );
      }
    }

    const board = await tx.board.create({
      data: {
        orgId: actor.orgId,
        title: input.title,
        template: template.key,
        notice: template.notice,
        ...input.image,
      },
    });
    for (const [index, list] of template.lists.entries()) {
      await createTemplateList(tx, board.id, list, index + 1);
    }
    for (const label of template.labels) {
      const existing = await tx.label.findFirst({
        where: { orgId: actor.orgId, name: label.name },
      });
      if (!existing) {
        await tx.label.create({ data: { ...label, orgId: actor.orgId } });
      }
    }
    await ensureRoles(tx, actor.orgId, template);

    await writeAudit(tx, actor, {
      action: ACTION.CREATE,
      entityType: ENTITY_TYPE.BOARD,
      entityId: board.id,
      entityTitle: board.title,
    });
    return board;
  });
};

/** Boards with their lists and readable rules, for settings and describe. */
export const listBoardsWithRules = async (actor: Actor) => {
  const [boards, names] = await Promise.all([
    db.board.findMany({
      where: { orgId: actor.orgId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        template: true,
        notice: true,
        lists: { orderBy: { order: "asc" } },
      },
    }),
    roleNames(db, actor.orgId),
  ]);
  return boards.map((board) => ({
    id: board.id,
    title: board.title,
    template: board.template,
    notice: board.notice,
    lists: board.lists.map((list) => ({
      id: list.id,
      title: list.title,
      key: list.templateKey,
      notice: list.notice,
      rules: describeRules(list, board.template, names),
    })),
  }));
};

export const listLabels = (actor: Actor) =>
  db.label.findMany({
    where: { orgId: actor.orgId },
    orderBy: { name: "asc" },
  });

export const listRoles = (actor: Actor) =>
  db.agentRole.findMany({
    where: { orgId: actor.orgId },
    orderBy: { name: "asc" },
  });

/**
 * Everything an agent needs to cold-start on a workspace (PRD S-1): boards
 * without image fields, lists with rules and notices, labels, and the
 * caller's own role and capabilities.
 */
export const describeWorkspace = async (actor: Actor) => {
  const [boards, labels] = await Promise.all([
    listBoardsWithRules(actor),
    listLabels(actor),
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
    labels: labels.map((l) => ({ id: l.id, name: l.name, color: l.color })),
  };
};

export const getBoard = async (actor: Actor, boardId: string) => {
  const board = await db.board.findFirst({
    where: { id: boardId, orgId: actor.orgId },
  });
  if (!board) throw notFound("Board");
  return board;
};
