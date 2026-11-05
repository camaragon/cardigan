import { createHash } from "node:crypto";
import { ENTITY_TYPE, Prisma } from "@prisma/client";
import { Tx } from "./audit";
import { DomainError } from "./errors";

export const hashPayload = (payload: unknown) =>
  createHash("sha256").update(JSON.stringify(payload)).digest("hex");

/**
 * Looks up a retry-safe external key (ADR 0001). Returns the existing record's
 * id when the same key was used with the same payload, throws a conflict when
 * it was used with a different payload, and returns null for a new key.
 */
export const findExternalKey = async (
  tx: Tx,
  orgId: string,
  scope: string,
  key: string,
  payloadHash: string,
) => {
  const existing = await tx.externalKey.findUnique({
    where: { orgId_scope_key: { orgId, scope, key } },
  });
  if (!existing) return null;
  if (existing.payloadHash !== payloadHash) {
    throw new DomainError(
      "conflict",
      `External key "${key}" was already used with a different payload`,
      { externalKey: key, existingId: existing.entityId },
    );
  }
  return existing;
};

export const saveExternalKey = (
  tx: Tx,
  data: {
    orgId: string;
    scope: string;
    key: string;
    payloadHash: string;
    entityType: ENTITY_TYPE;
    entityId: string;
    tokenId?: string;
    result?: Prisma.InputJsonValue;
  },
) => tx.externalKey.create({ data });

export const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";
