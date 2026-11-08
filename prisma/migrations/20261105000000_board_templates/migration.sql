-- AlterTable
ALTER TABLE "Board" ADD COLUMN "notice" TEXT,
ADD COLUMN "template" TEXT NOT NULL DEFAULT 'blank';
