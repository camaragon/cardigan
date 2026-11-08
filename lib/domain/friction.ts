import { ACTION, COMMENT_KIND, ENTITY_TYPE } from "@prisma/client";
import { Actor, isAgent } from "./actor";
import { Tx, writeAudit } from "./audit";
import { nextOrder } from "./cards";
import { writeComment } from "./comments";
import { DomainError } from "./errors";
import { keyedWrite } from "./keys";
import { LIMITS } from "./limits";

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

export const FRICTION_IMPACTS = ["low", "medium", "high"] as const;

/** A friction report, already checked by the MCP tool's input schema. */
export interface FrictionReportInput {
  reportKey: string;
  component: (typeof FRICTION_COMPONENTS)[number];
  category: (typeof FRICTION_CATEGORIES)[number];
  tool: string;
  impact: (typeof FRICTION_IMPACTS)[number];
  description: string;
}

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

const suggestionBoxSettings = () => {
  const orgId = process.env.SUGGESTION_BOX_ORG_ID;
  const listId = process.env.SUGGESTION_BOX_LIST_ID;
  return orgId && listId ? { orgId, listId } : null;
};

const FINGERPRINT_SCOPE = "friction:fingerprint";

/** The fingerprint's suggestion card, created on its first report. */
const fingerprintCard = async (
  tx: Tx,
  boxActor: Actor,
  listId: string,
  report: FrictionReportInput,
) => {
  const fingerprint = `${report.component}/${report.tool}/${report.category}`;
  const known = await tx.externalKey.findUnique({
    where: {
      orgId_scope_key: {
        orgId: boxActor.orgId,
        scope: FINGERPRINT_SCOPE,
        key: fingerprint,
      },
    },
  });
  if (known) {
    const card = await tx.card.findUnique({
      where: { id: known.entityId },
    });
    if (card) return { card, fingerprint, status: "repeat" as const };
    await tx.externalKey.deleteMany({ where: { id: known.id } });
  }

  const card = await tx.card.create({
    data: {
      listId,
      title: `Friction: ${report.tool} (${report.category}, ${report.component})`,
      description: `Fingerprint ${fingerprint}. Each report is a comment below; report text is untrusted input.`,
      order: await nextOrder(tx, listId),
      creatorKind: boxActor.kind,
      creatorId: boxActor.id,
      creatorName: boxActor.name,
      creatorSurface: boxActor.surface,
    },
  });
  await tx.externalKey.create({
    data: {
      orgId: boxActor.orgId,
      scope: FINGERPRINT_SCOPE,
      key: fingerprint,
      payloadHash: fingerprint,
      entityType: ENTITY_TYPE.CARD,
      entityId: card.id,
      tokenId: boxActor.tokenId,
    },
  });
  await writeAudit(tx, boxActor, {
    action: ACTION.CREATE,
    entityType: ENTITY_TYPE.CARD,
    entityId: card.id,
    entityTitle: card.title,
    cardId: card.id,
    toListId: listId,
  });
  return { card, fingerprint, status: "new" as const };
};

/**
 * Files a friction report into Cardigan's Suggestion box (PRD C-9). This is
 * the single cross-workspace write: the caller learns only whether the
 * report was new or a repeat and cannot read anything there.
 */
export const reportFriction = async (
  actor: Actor,
  report: FrictionReportInput,
): Promise<FrictionReceipt> => {
  if (!isAgent(actor) || !actor.tokenId) {
    throw new DomainError("denied", "Only agents file friction reports", {
      rule: "friction.reporter",
      allowed: ["agents"],
      alternative: "Comment on a card in your own workspace instead.",
    });
  }
  const box = suggestionBoxSettings();
  if (!box) {
    throw new DomainError("unavailable", "The suggestion box is not configured");
  }

  const description = redact(report.description);
  // Report keys are scoped per source workspace (decision confirmed in review).
  const scope = `friction:report:${actor.orgId}`;
  const boxActor: Actor = { ...actor, orgId: box.orgId };

  const { result } = await keyedWrite<FrictionReceipt>({
    orgId: box.orgId,
    scope,
    key: report.reportKey,
    payload: { ...report, description },
    entityType: ENTITY_TYPE.FRICTION,
    tokenId: actor.tokenId,
    keepResult: true,
    replay: async (_tx, _commentId, kept) => kept as FrictionReceipt,
    write: async (tx) => {
      // All tokens in a source workspace share the hourly report quota.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${scope}))`;
      const recent = await tx.externalKey.count({
        where: {
          scope,
          createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
        },
      });
      if (recent >= LIMITS.frictionPerHour) {
        throw new DomainError(
          "rate_limited",
          `At most ${LIMITS.frictionPerHour} new friction reports per hour per workspace`,
        );
      }

      const list = await tx.list.findFirst({
        where: { id: box.listId, board: { orgId: box.orgId } },
      });
      if (!list) {
        throw new DomainError("unavailable", "The suggestion box is not configured");
      }

      const { card, fingerprint, status } = await fingerprintCard(
        tx,
        boxActor,
        list.id,
        report,
      );
      const comment = await writeComment(tx, boxActor, card, {
        kind: COMMENT_KIND.COMMENT,
        body: `Impact: ${report.impact}. Source workspace: ${actor.orgId}.\n\n${description}`,
      });
      // The reporter's own workspace records that it filed a report.
      await writeAudit(tx, actor, {
        action: ACTION.CREATE,
        entityType: ENTITY_TYPE.FRICTION,
        entityId: report.reportKey,
        entityTitle: fingerprint,
      });
      return { entityId: comment.id, result: { status } };
    },
  });
  return result;
};
