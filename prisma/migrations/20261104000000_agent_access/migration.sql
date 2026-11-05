-- CreateEnum
CREATE TYPE "COMMENT_KIND" AS ENUM ('COMMENT', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "ACTOR_KIND" AS ENUM ('OWNER', 'MEMBER', 'AGENT');

-- CreateEnum
CREATE TYPE "SURFACE" AS ENUM ('UI', 'MCP');

-- CreateEnum
CREATE TYPE "OUTCOME" AS ENUM ('OK', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ACTION" ADD VALUE 'MOVE';
ALTER TYPE "ACTION" ADD VALUE 'COMMENT';
ALTER TYPE "ACTION" ADD VALUE 'REVOKE';
ALTER TYPE "ACTION" ADD VALUE 'CALL';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ENTITY_TYPE" ADD VALUE 'COMMENT';
ALTER TYPE "ENTITY_TYPE" ADD VALUE 'AGENT_TOKEN';
ALTER TYPE "ENTITY_TYPE" ADD VALUE 'FRICTION';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "actorKind" "ACTOR_KIND" NOT NULL DEFAULT 'MEMBER',
ADD COLUMN     "agentRole" TEXT,
ADD COLUMN     "cardId" TEXT,
ADD COLUMN     "errorType" TEXT,
ADD COLUMN     "eventId" INTEGER,
ADD COLUMN     "fromListId" TEXT,
ADD COLUMN     "outcome" "OUTCOME" NOT NULL DEFAULT 'OK',
ADD COLUMN     "position" INTEGER,
ADD COLUMN     "surface" "SURFACE" NOT NULL DEFAULT 'UI',
ADD COLUMN     "toListId" TEXT,
ADD COLUMN     "tokenId" TEXT,
ADD COLUMN     "tool" TEXT;

-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "notice" TEXT,
ADD COLUMN     "template" TEXT NOT NULL DEFAULT 'plain';

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "creatorId" TEXT,
ADD COLUMN     "creatorKind" "ACTOR_KIND" NOT NULL DEFAULT 'MEMBER',
ADD COLUMN     "creatorName" TEXT,
ADD COLUMN     "creatorSurface" "SURFACE" NOT NULL DEFAULT 'UI',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "List" ADD COLUMN     "notice" TEXT,
ADD COLUMN     "rules" JSONB,
ADD COLUMN     "templateKey" TEXT;

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" "COMMENT_KIND" NOT NULL DEFAULT 'COMMENT',
    "cardId" TEXT NOT NULL,
    "duplicateOfCardId" TEXT,
    "actorKind" "ACTOR_KIND" NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorImage" TEXT,
    "surface" "SURFACE" NOT NULL,
    "tokenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalKey" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "entityType" "ENTITY_TYPE" NOT NULL,
    "entityId" TEXT NOT NULL,
    "tokenId" TEXT,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRole" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capabilities" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentToken" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comment_cardId_idx" ON "Comment"("cardId");

-- CreateIndex
CREATE INDEX "Comment_orgId_idx" ON "Comment"("orgId");

-- CreateIndex
CREATE INDEX "ExternalKey_tokenId_scope_createdAt_idx" ON "ExternalKey"("tokenId", "scope", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalKey_orgId_scope_key_key" ON "ExternalKey"("orgId", "scope", "key");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRole_orgId_key_key" ON "AgentRole"("orgId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "AgentToken_secretHash_key" ON "AgentToken"("secretHash");

-- CreateIndex
CREATE INDEX "AgentToken_orgId_idx" ON "AgentToken"("orgId");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_createdAt_idx" ON "AuditLog"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_orgId_eventId_key" ON "AuditLog"("orgId", "eventId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentToken" ADD CONSTRAINT "AgentToken_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AgentRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

