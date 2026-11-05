import { createHash } from "node:crypto";
import { ENTITY_TYPE, Prisma } from "@prisma/client";
import { transaction, Tx } from "./audit";
import { DomainError } from "./errors";

const hashPayload = (payload: unknown) =>
  createHash("sha256").update(JSON.stringify(payload)).digest("hex");

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

export interface KeyedWrite<T> {
  orgId: string;
  /** Key scope: the agent role or the person (see keyScope). */
  scope: string;
  /** The caller's external key; without one the write simply runs. */
  key?: string;
  /** What the key promises: a replay must send the same payload. */
  payload: unknown;
  entityType: ENTITY_TYPE;
  tokenId?: string;
  /** Keeps the result with the key, for replays that must return it as it was. */
  keepResult?: boolean;
  /** Performs the write and returns its result and the new entity's id. */
  write: (tx: Tx) => Promise<{ entityId: string; result: T }>;
  /** Returns the result of the earlier write that took the key. */
  replay: (tx: Tx, entityId: string, kept: Prisma.JsonValue) => Promise<T>;
}

/**
 * Runs a write under a retry-safe external key in one transaction (ADR 0001,
 * PRD C-3). The same key with the same payload returns the earlier result
 * without writing again; the same key with another payload is a conflict. A
 * concurrent call that took the key first is retried once, as a replay.
 */
export const keyedWrite = async <T>(
  input: KeyedWrite<T>,
): Promise<{ result: T; created: boolean }> => {
  const payloadHash = hashPayload(input.payload);

  const run = () =>
    transaction(async (tx) => {
      if (input.key) {
        const existing = await tx.externalKey.findUnique({
          where: {
            orgId_scope_key: {
              orgId: input.orgId,
              scope: input.scope,
              key: input.key,
            },
          },
        });
        if (existing) {
          if (existing.payloadHash !== payloadHash) {
            throw new DomainError(
              "conflict",
              `External key "${input.key}" was already used with a different payload`,
              { externalKey: input.key, existingId: existing.entityId },
            );
          }
          return {
            result: await input.replay(tx, existing.entityId, existing.result),
            created: false,
          };
        }
      }

      const { entityId, result } = await input.write(tx);
      if (input.key) {
        await tx.externalKey.create({
          data: {
            orgId: input.orgId,
            scope: input.scope,
            key: input.key,
            payloadHash,
            entityType: input.entityType,
            entityId,
            tokenId: input.tokenId,
            result: input.keepResult
              ? (result as Prisma.InputJsonValue)
              : undefined,
          },
        });
      }
      return { result, created: true };
    });

  try {
    return await run();
  } catch (error) {
    if (input.key && isUniqueViolation(error)) return run();
    throw error;
  }
};
