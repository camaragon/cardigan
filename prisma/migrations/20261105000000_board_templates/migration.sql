-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "notice" TEXT,
ADD COLUMN     "template" TEXT NOT NULL DEFAULT 'plain';

-- AlterTable
ALTER TABLE "List" ADD COLUMN     "notice" TEXT,
ADD COLUMN     "rules" JSONB,
ADD COLUMN     "templateKey" TEXT;

