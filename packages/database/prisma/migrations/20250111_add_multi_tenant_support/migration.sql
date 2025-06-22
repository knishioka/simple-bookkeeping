-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tax_id" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_organizations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- CreateIndex
CREATE INDEX "user_organizations_organization_id_idx" ON "user_organizations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_organizations_user_id_organization_id_key" ON "user_organizations"("user_id", "organization_id");

-- AddForeignKey
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add organizationId to business tables
ALTER TABLE "accounting_periods" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "accounts" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "journal_entries" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "partners" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "organization_id" TEXT;

-- CreateIndex
CREATE INDEX "accounting_periods_organization_id_idx" ON "accounting_periods"("organization_id");
CREATE INDEX "accounts_organization_id_idx" ON "accounts"("organization_id");
CREATE INDEX "journal_entries_organization_id_idx" ON "journal_entries"("organization_id");
CREATE INDEX "partners_organization_id_idx" ON "partners"("organization_id");
CREATE INDEX "audit_logs_organization_id_idx" ON "audit_logs"("organization_id");

-- Update unique constraints to include organizationId
DROP INDEX "accounts_code_key";
CREATE UNIQUE INDEX "accounts_organization_id_code_key" ON "accounts"("organization_id", "code");

DROP INDEX "partners_code_key";
CREATE UNIQUE INDEX "partners_organization_id_code_key" ON "partners"("organization_id", "code");

DROP INDEX "journal_entries_entry_number_key";
CREATE UNIQUE INDEX "journal_entries_organization_id_entry_number_key" ON "journal_entries"("organization_id", "entry_number");

-- Temporary: Create a default organization for existing data
INSERT INTO "organizations" ("id", "name", "code", "email", "created_at", "updated_at")
VALUES ('default-org-id', 'Default Organization', 'DEFAULT', 'admin@example.com', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Temporary: Assign existing data to default organization
UPDATE "accounting_periods" SET "organization_id" = 'default-org-id' WHERE "organization_id" IS NULL;
UPDATE "accounts" SET "organization_id" = 'default-org-id' WHERE "organization_id" IS NULL;
UPDATE "journal_entries" SET "organization_id" = 'default-org-id' WHERE "organization_id" IS NULL;
UPDATE "partners" SET "organization_id" = 'default-org-id' WHERE "organization_id" IS NULL;
UPDATE "audit_logs" SET "organization_id" = 'default-org-id' WHERE "organization_id" IS NULL;

-- Temporary: Add all existing users to default organization as ADMIN
INSERT INTO "user_organizations" ("id", "user_id", "organization_id", "role", "is_default", "joined_at")
SELECT gen_random_uuid(), "id", 'default-org-id', 'ADMIN', true, CURRENT_TIMESTAMP
FROM "users";

-- Make organizationId required after data migration
ALTER TABLE "accounting_periods" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "accounts" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "journal_entries" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "partners" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "audit_logs" ALTER COLUMN "organization_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;