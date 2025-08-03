-- AlterTable to add missing columns
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "code" VARCHAR(255);
UPDATE "accounts" SET "code" = id WHERE "code" IS NULL;
ALTER TABLE "accounts" ALTER COLUMN "code" SET NOT NULL;

ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "entry_number" VARCHAR(255);
UPDATE "journal_entries" SET "entry_number" = id WHERE "entry_number" IS NULL;
ALTER TABLE "journal_entries" ALTER COLUMN "entry_number" SET NOT NULL;

ALTER TABLE "journal_entry_lines" ADD COLUMN IF NOT EXISTS "line_number" INTEGER;
UPDATE "journal_entry_lines" SET "line_number" = 1 WHERE "line_number" IS NULL;
ALTER TABLE "journal_entry_lines" ALTER COLUMN "line_number" SET NOT NULL;

ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "partner_type" VARCHAR(50);
UPDATE "partners" SET "partner_type" = 'CUSTOMER' WHERE "partner_type" IS NULL;
ALTER TABLE "partners" ALTER COLUMN "partner_type" SET NOT NULL;

ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "name_kana" VARCHAR(255);

-- Add unique constraints
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_code_key') THEN
        ALTER TABLE "accounts" ADD CONSTRAINT "accounts_code_key" UNIQUE ("code");
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_entry_number_key') THEN
        ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_entry_number_key" UNIQUE ("entry_number");
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_entry_lines_journal_entry_id_line_number_key') THEN
        ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journal_entry_id_line_number_key" UNIQUE ("journal_entry_id", "line_number");
    END IF;
END $$;