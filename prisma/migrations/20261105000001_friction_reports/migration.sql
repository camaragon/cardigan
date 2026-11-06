-- AlterEnum
ALTER TYPE "ENTITY_TYPE" ADD VALUE 'FRICTION';

-- AlterTable
ALTER TABLE "ExternalKey" ADD COLUMN     "result" JSONB;

