#!/usr/bin/env tsx
/**
 * Migration script from Prisma (PostgreSQL) to Supabase
 * This script migrates existing data from the current database to Supabase
 */

import { PrismaClient } from '@simple-bookkeeping/database';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

import type { Database, Json } from '../src/types/database.types';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
  },
});

async function migrateOrganizations() {
  console.log('Migrating organizations...');
  const organizations = await prisma.organization.findMany();

  for (const org of organizations) {
    const { error } = await supabase.from('organizations').upsert({
      id: org.id,
      name: org.name,
      code: org.code,
      created_at: org.createdAt.toISOString(),
      updated_at: org.updatedAt.toISOString(),
    });

    if (error) {
      console.error(`Error migrating organization ${org.id}:`, error);
    }
  }
  console.log(`Migrated ${organizations.length} organizations`);
}

async function migrateUsers() {
  console.log('Migrating users...');
  const users = await prisma.user.findMany();

  for (const user of users) {
    // Note: Supabase Auth users need to be created separately
    // This only migrates the user profile data
    const { error } = await supabase.from('users').upsert({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Database['public']['Enums']['user_role'],
      organization_id: user.organizationId,
      is_active: user.isActive,
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString(),
    });

    if (error) {
      console.error(`Error migrating user ${user.id}:`, error);
    }
  }
  console.log(`Migrated ${users.length} users`);
}

async function migrateAccountingPeriods() {
  console.log('Migrating accounting periods...');
  const periods = await prisma.accountingPeriod.findMany();

  for (const period of periods) {
    const { error } = await supabase.from('accounting_periods').upsert({
      id: period.id,
      organization_id: period.organizationId,
      fiscal_year: period.fiscalYear,
      name: period.name,
      start_date: period.startDate.toISOString().split('T')[0],
      end_date: period.endDate.toISOString().split('T')[0],
      is_closed: period.isClosed,
      created_at: period.createdAt.toISOString(),
      updated_at: period.updatedAt.toISOString(),
    });

    if (error) {
      console.error(`Error migrating period ${period.id}:`, error);
    }
  }
  console.log(`Migrated ${periods.length} accounting periods`);
}

async function migrateAccounts() {
  console.log('Migrating accounts...');
  const accounts = await prisma.account.findMany();

  for (const account of accounts) {
    const { error } = await supabase.from('accounts').upsert({
      id: account.id,
      organization_id: account.organizationId,
      code: account.code,
      name: account.name,
      account_type: account.accountType as Database['public']['Enums']['account_type'],
      category: account.category,
      parent_account_id: account.parentAccountId,
      is_active: account.isActive,
      created_at: account.createdAt.toISOString(),
      updated_at: account.updatedAt.toISOString(),
    });

    if (error) {
      console.error(`Error migrating account ${account.id}:`, error);
    }
  }
  console.log(`Migrated ${accounts.length} accounts`);
}

async function migratePartners() {
  console.log('Migrating partners...');
  const partners = await prisma.partner.findMany();

  for (const partner of partners) {
    const { error } = await supabase.from('partners').upsert({
      id: partner.id,
      organization_id: partner.organizationId,
      code: partner.code,
      name: partner.name,
      partner_type: partner.partnerType as Database['public']['Enums']['partner_type'],
      contact_info: partner.contactInfo as Json,
      is_active: partner.isActive,
      created_at: partner.createdAt.toISOString(),
      updated_at: partner.updatedAt.toISOString(),
    });

    if (error) {
      console.error(`Error migrating partner ${partner.id}:`, error);
    }
  }
  console.log(`Migrated ${partners.length} partners`);
}

async function migrateJournalEntries() {
  console.log('Migrating journal entries...');
  const entries = await prisma.journalEntry.findMany({
    include: {
      journalEntryLines: true,
    },
  });

  for (const entry of entries) {
    // Migrate journal entry
    const { error: entryError } = await supabase.from('journal_entries').upsert({
      id: entry.id,
      organization_id: entry.organizationId,
      accounting_period_id: entry.accountingPeriodId,
      entry_number: entry.entryNumber,
      entry_date: entry.entryDate.toISOString().split('T')[0],
      description: entry.description,
      status: entry.status as Database['public']['Enums']['journal_status'],
      created_by: entry.createdBy,
      approved_by: entry.approvedBy,
      created_at: entry.createdAt.toISOString(),
      updated_at: entry.updatedAt.toISOString(),
    });

    if (entryError) {
      console.error(`Error migrating entry ${entry.id}:`, entryError);
      continue;
    }

    // Migrate journal entry lines
    for (const line of entry.journalEntryLines) {
      const { error: lineError } = await supabase.from('journal_entry_lines').upsert({
        id: line.id,
        journal_entry_id: line.journalEntryId,
        account_id: line.accountId,
        debit_amount: line.debitAmount.toNumber(),
        credit_amount: line.creditAmount.toNumber(),
        line_number: line.lineNumber,
        description: line.description,
        partner_id: line.partnerId,
        created_at: line.createdAt.toISOString(),
        updated_at: line.updatedAt.toISOString(),
      });

      if (lineError) {
        console.error(`Error migrating line ${line.id}:`, lineError);
      }
    }
  }
  console.log(`Migrated ${entries.length} journal entries`);
}

async function migrateAuditLogs() {
  console.log('Migrating audit logs...');
  const logs = await prisma.auditLog.findMany();

  for (const log of logs) {
    const { error } = await supabase.from('audit_logs').upsert({
      id: log.id,
      organization_id: log.organizationId,
      user_id: log.userId,
      action: log.action,
      entity_type: log.entityType,
      entity_id: log.entityId,
      old_values: log.oldValues as Json,
      new_values: log.newValues as Json,
      ip_address: log.ipAddress,
      user_agent: log.userAgent,
      created_at: log.createdAt.toISOString(),
    });

    if (error) {
      console.error(`Error migrating audit log ${log.id}:`, error);
    }
  }
  console.log(`Migrated ${logs.length} audit logs`);
}

async function main() {
  try {
    console.log('Starting migration from Prisma to Supabase...');

    // Order matters due to foreign key constraints
    await migrateOrganizations();
    await migrateUsers();
    await migrateAccountingPeriods();
    await migrateAccounts();
    await migratePartners();
    await migrateJournalEntries();
    await migrateAuditLogs();

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration if executed directly
if (require.main === module) {
  main();
}
