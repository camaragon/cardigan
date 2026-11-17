import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { notFound } from "./errors";
import { Tx } from "./audit";
import { DomainError } from "./errors";
import { lockBoardOrder } from "./ordering";

/** Reserve current and old prefixes together; a board can reuse its own alias. */
export const reservePrefix = async (tx: Tx, orgId: string, boardId: string, prefix: string) => {
  await tx.boardKeyPrefix.createMany({ data: [{ orgId, boardId, prefix }], skipDuplicates: true });
  const reserved = await tx.boardKeyPrefix.findUniqueOrThrow({ where: { orgId_prefix: { orgId, prefix } } });
  if (reserved.boardId !== boardId) {
    throw new DomainError("conflict", "This prefix belongs to another board in this workspace");
  }
};

/** Returns the first reserved number, or null for boards without keys. */
export const allocateCardNumbers = async (tx: Tx, boardId: string, count = 1) => {
  await lockBoardOrder(tx, boardId);
  const board = await tx.board.findUniqueOrThrow({ where: { id: boardId } });
  if (!board.keyPrefix || count === 0) return null;
  const updated = await tx.board.update({
    where: { id: boardId }, data: { nextCardNumber: { increment: count } },
  });
  return updated.nextCardNumber - count;
};

/** Ids and current/historical keys always resolve inside one workspace. */
export const cardReferenceWhere = (orgId: string, reference: string): Prisma.CardWhereInput => {
  const match = /^([A-Z][A-Z0-9]{1,9})-([1-9][0-9]*)$/i.exec(reference);
  const number = match ? Number(match[2]) : 0;
  return {
    list: { board: { orgId } },
    OR: [
      { id: reference },
      ...(match && number <= 2147483647 ? [{
        number, list: { board: { keyPrefixes: { some: { prefix: match[1].toUpperCase() } } } },
      }] : []),
    ],
  };
};

export const resolveCardId = async (orgId: string, reference: string) => {
  const card = await db.card.findFirst({ where: cardReferenceWhere(orgId, reference), select: { id: true } });
  if (!card) throw notFound("Card");
  return card.id;
};
