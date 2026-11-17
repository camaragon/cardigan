ALTER TABLE "Board" ADD COLUMN "keyPrefix" TEXT,
ADD COLUMN "nextCardNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Card" ADD COLUMN "number" INTEGER;
CREATE TABLE "BoardKeyPrefix" (
    "orgId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    CONSTRAINT "BoardKeyPrefix_pkey" PRIMARY KEY ("orgId", "prefix"),
    CONSTRAINT "BoardKeyPrefix_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "BoardKeyPrefix_boardId_idx" ON "BoardKeyPrefix"("boardId");
