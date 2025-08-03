-- Add is_system column
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "is_system" BOOLEAN NOT NULL DEFAULT false;