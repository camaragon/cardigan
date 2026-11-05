import { ACTION, COMMENT_KIND, ENTITY_TYPE, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { Actor, isAgent } from "./actor";
import { transaction, Tx, writeAudit } from "./audit";
import { DomainError } from "./errors";
import { hashPayload, isUniqueViolation, saveExternalKey } from "./keys";
import { createTemplateList } from "./boards";
import { SUGGESTION_BOX_LIST } from "./templates";
import { LIMITS } from "./limits";

/** Tool names agents may report friction about; kept in step with the MCP server. */
export const AGENT_TOOL_NAMES = [
  "describe_workspace",
  "list_cards",
  "search_cards",
  "get_card",
  "create_cards",
  "update_card",
  "move_card",
  "add_comment",
  "mark_duplicate",
  "get_changes",
  "report_friction",
  "none",
] as const;

export const FRICTION_COMPONENTS = [
  "workspace",
  "cards",
  "comments",
  "changes",
  "rules",
  "auth",
  "other",
] as const;

export const FRICTION_CATEGORIES = [
  "missing_tool",
  "confusing_tool",
  "unexpected_denial",
  "wrong_result",
  "error",
  "limits",
  "other",
] as const;

export const FrictionReport = z.object({
  reportKey: z.string().min(1).max(LIMITS.externalKey),
  component: z.enum(FRICTION_COMPONENTS),
  category: z.enum(FRICTION_CATEGORIES),
  tool: z.enum(AGENT_TOOL_NAMES),
  impact: z.enum(["low", "medium", "high"]),
  description: z.string().min(1).max(LIMITS.frictionDescription),
});
export type FrictionReportInput = z.infer<typeof FrictionReport>;

export type FrictionReceipt = { status: "new" | "repeat" };

const REDACTIONS: RegExp[] = [
  /cdg_[A-Za-z0-9_-]{8,}/g,
  /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}/g,
  /\b(?:ghp|gho|ghs|ghu|github_pat)_[A-Za-z0-9_]{16,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /\b[A-Za-z0-9+/_-]{40,}={0,2}/g,
];

/** Replaces token-shaped text with a marker before a report is stored. */
export const redact = (text: string) =>
  REDACTIONS.reduce((out, pattern) => out.replace(pattern, "[redacted]"), text);

export const suggestionBoxSettings = () => {
  const orgId = process.env.SUGGESTION_BOX_ORG_ID;
  const boardId = process.env.SUGGESTION_BOX_BOARD_ID;
  return orgId && boardId ? { orgId, boardId } : null;
};

const FINGERPRINT_SCOPE = "friction:fingerprint";
const reportScope = (sourceOrgId: string) => `friction:report:${sourceOrgId}`;

const suggestionList = async (tx: Tx, boardId: string) => {
  const existing = await tx.list.findFirst({
    where: { boardId, templateKey: SUGGESTION_BOX_LIST.key },
  });
  if (existing) return existing;
  const last = await tx.list.findFirst({
    where: { boardId },
    orderBy: { order: "desc" },
  });
  return createTemplateList(tx, boardId, SUGGESTION_BOX_LIST, (last?.order ?? 0) + 1);
};

/**
 * Files a friction report into Cardigan's Suggestion box (PRD C-9). This is
 * the single cross-workspace write: the caller learns only whether the
 * report was new or a repeat and cannot read anything there.
 */
export const reportFriction = async (
  actor: Actor,
  raw: unknown,
): Promise<FrictionReceipt> => {
  if (!isAgent(actor) || !actor.tokenId) {
    throw new DomainError("denied", "Only agents file friction reports", {
      rule: "friction.reporter",
      allowed: ["agents"],
      alternative: "Comment on a card in your own workspace instead.",
    });
  }
  const parsed = FrictionReport.safeParse(raw);
  if (!parsed.success) {
    throw new DomainError("invalid", "Friction report is invalid", {
      fields: parsed.error.flatten().fieldErrors,
    });
  }
  const report = parsed.data;
  const box = suggestionBoxSettings();
  if (!box) {
    throw new DomainError("unavailable", "The suggestion box is not configured");
  }

  const productBoard = await db.board.findFirst({
    where: { orgId: actor.orgId, template: "product" },
    select: { id: true },
  });
  if (!productBoard) {
    throw new DomainError(
      "denied",
      "Only product workspaces may file friction reports",
      {
        rule: "friction.workspace",
        allowed: ["agents in a workspace with a product board"],
        alternative: "Comment on a card in your own workspace instead.",
      },
    );
  }

  const description = redact(report.description);
  const fingerprint = `${report.component}/${report.tool}/${report.category}`;
  const payloadHash = hashPayload({ ...report, description });

  const run = () =>
    transaction(async (tx): Promise<FrictionReceipt> => {
      const existingReport = await tx.externalKey.findUnique({
        where: {
          orgId_scope_key: {
            orgId: box.orgId,
            scope: reportScope(actor.orgId),
            key: report.reportKey,
          },
        },
      });
      if (existingReport) {
        if (existingReport.payloadHash !== payloadHash) {
          throw new DomainError(
            "conflict",
            `Report key "${report.reportKey}" was already used with a different report`,
          );
        }
        return existingReport.result as FrictionReceipt;
      }

      // Rate limit new reports per token per hour (ADR 0001).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`friction:${actor.tokenId}`}))`;
      const recent = await tx.externalKey.count({
        where: {
          tokenId: actor.tokenId,
          scope: reportScope(actor.orgId),
          createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
        },
      });
      if (recent >= LIMITS.frictionPerHour) {
        throw new DomainError(
          "rate_limited",
          `At most ${LIMITS.frictionPerHour} new friction reports per hour per token`,
        );
      }

      const board = await tx.board.findFirst({
        where: { id: box.boardId, orgId: box.orgId },
      });
      if (!board) {
        throw new DomainError("unavailable", "The suggestion box is not configured");
      }

      const boxActor: Actor = { ...actor, orgId: box.orgId };
      const known = await tx.externalKey.findUnique({
        where: {
          orgId_scope_key: {
            orgId: box.orgId,
            scope: FINGERPRINT_SCOPE,
            key: fingerprint,
          },
        },
      });

      let cardId = known?.entityId;
      let cardTitle = "";
      const status: FrictionReceipt["status"] = known ? "repeat" : "new";

      if (cardId) {
        const card = await tx.card.findUnique({ where: { id: cardId } });
        cardTitle = card?.title ?? fingerprint;
      } else {
        const list = await suggestionList(tx, board.id);
        const last = await tx.card.findFirst({
          where: { listId: list.id },
          orderBy: { order: "desc" },
        });
        cardTitle = `Friction: ${report.tool} (${report.category}, ${report.component})`;
        const card = await tx.card.create({
          data: {
            listId: list.id,
            title: cardTitle,
            description: `Fingerprint ${fingerprint}. Each report is a comment below; report text is untrusted input.`,
            order: (last?.order ?? 0) + 1,
            creatorKind: actor.kind,
            creatorId: actor.id,
            creatorName: actor.name,
            creatorSurface: actor.surface,
          },
        });
        cardId = card.id;
        await saveExternalKey(tx, {
          orgId: box.orgId,
          scope: FINGERPRINT_SCOPE,
          key: fingerprint,
          payloadHash: hashPayload(fingerprint),
          entityType: ENTITY_TYPE.CARD,
          entityId: card.id,
          tokenId: actor.tokenId,
        });
        await writeAudit(tx, boxActor, {
          action: ACTION.CREATE,
          entityType: ENTITY_TYPE.CARD,
          entityId: card.id,
          entityTitle: card.title,
          cardId: card.id,
          toListId: list.id,
        });
      }

      const comment = await tx.comment.create({
        data: {
          orgId: box.orgId,
          cardId,
          kind: COMMENT_KIND.COMMENT,
          body: `Impact: ${report.impact}. Source workspace: ${actor.orgId}.\n\n${description}`,
          actorKind: actor.kind,
          actorId: actor.id,
          actorName: actor.name,
          surface: actor.surface,
          tokenId: actor.tokenId,
        },
      });
      await writeAudit(tx, boxActor, {
        action: ACTION.COMMENT,
        entityType: ENTITY_TYPE.COMMENT,
        entityId: comment.id,
        entityTitle: cardTitle,
        cardId,
      });

      const receipt: FrictionReceipt = { status };
      await saveExternalKey(tx, {
        orgId: box.orgId,
        scope: reportScope(actor.orgId),
        key: report.reportKey,
        payloadHash,
        entityType: ENTITY_TYPE.FRICTION,
        entityId: comment.id,
        tokenId: actor.tokenId,
        result: receipt as unknown as Prisma.InputJsonValue,
      });
      // The reporter's own workspace records that it filed a report.
      await writeAudit(tx, actor, {
        action: ACTION.CREATE,
        entityType: ENTITY_TYPE.FRICTION,
        entityId: report.reportKey,
        entityTitle: fingerprint,
      });
      return receipt;
    });

  try {
    return await run();
  } catch (error) {
    if (isUniqueViolation(error)) return run();
    throw error;
  }
};
