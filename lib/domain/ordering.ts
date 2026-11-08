import { Tx } from "./audit";

/** Acquire before position reads or row writes; one board lock covers both lists. */
export const lockBoardOrder = async (tx: Tx, boardId: string) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(1, hashtext(${boardId}))`;
};
