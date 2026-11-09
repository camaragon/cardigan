CREATE TYPE "CARD_PRIORITY" AS ENUM ('none', 'low', 'medium', 'high');

ALTER TABLE "Card"
  ADD COLUMN "priority" "CARD_PRIORITY" NOT NULL DEFAULT 'none',
  ADD COLUMN "assignee" VARCHAR(80);

CREATE TABLE "CardDependency" (
  "cardId" TEXT NOT NULL,
  "blockerId" TEXT NOT NULL,
  CONSTRAINT "CardDependency_pkey" PRIMARY KEY ("cardId", "blockerId"),
  CONSTRAINT "CardDependency_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CardDependency_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CardDependency_blockerId_idx" ON "CardDependency"("blockerId");
