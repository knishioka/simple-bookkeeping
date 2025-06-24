-- AlterTable
ALTER TABLE "partners" ADD COLUMN "name_kana" TEXT NOT NULL DEFAULT '';

-- Remove default after migration
ALTER TABLE "partners" ALTER COLUMN "name_kana" DROP DEFAULT;