-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('SOLE_PROPRIETOR', 'CORPORATION', 'BOTH');

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "description" TEXT,
ADD COLUMN     "organization_type" "OrganizationType" NOT NULL DEFAULT 'BOTH';

-- CreateIndex
CREATE INDEX "accounts_organization_type_idx" ON "accounts"("organization_type");