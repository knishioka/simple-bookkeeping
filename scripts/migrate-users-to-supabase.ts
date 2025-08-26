#!/usr/bin/env tsx

/* eslint-disable no-console */
/* eslint-disable import/no-unresolved */

/**
 * Migration script to migrate existing users from JWT auth to Supabase Auth
 *
 * This script:
 * 1. Connects to the existing PostgreSQL database
 * 2. Exports all user data
 * 3. Creates Supabase auth users
 * 4. Associates users with their organizations
 * 5. Sends password reset emails
 */

import { randomBytes } from 'crypto';

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize Supabase admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface MigrationResult {
  success: boolean;
  userId: string;
  email: string;
  error?: string;
}

async function migrateUsers() {
  console.log('Starting user migration to Supabase Auth...\n');

  try {
    // Get all users from existing database
    const users = await prisma.user.findMany({
      include: {
        organization: true,
      },
    });

    console.log(`Found ${users.length} users to migrate\n`);

    const results: MigrationResult[] = [];

    for (const user of users) {
      console.log(`Migrating user: ${user.email}...`);

      try {
        // Generate a temporary random password (user will need to reset)
        const tempPassword = randomBytes(32).toString('hex');

        // Create user in Supabase Auth
        const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: tempPassword,
          email_confirm: true, // Auto-confirm email since these are existing users
          app_metadata: {
            organizations: [
              {
                id: user.organizationId,
                name: user.organization.name,
                role: user.role,
                isDefault: true,
              },
            ],
            current_organization_id: user.organizationId,
            current_role: user.role,
          },
          user_metadata: {
            name: user.name,
          },
        });

        if (createError) {
          // Check if user already exists
          if (createError.message.includes('already registered')) {
            console.log(`  User already exists, updating metadata...`);

            // Get existing user
            const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
            const existingUser = existingUsers?.users.find((u) => u.email === user.email);

            if (existingUser) {
              // Update user metadata
              const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                existingUser.id,
                {
                  app_metadata: {
                    ...existingUser.app_metadata,
                    organizations: [
                      ...(existingUser.app_metadata?.organizations || []),
                      {
                        id: user.organizationId,
                        name: user.organization.name,
                        role: user.role,
                        isDefault: false,
                      },
                    ],
                  },
                }
              );

              if (updateError) {
                throw updateError;
              }

              results.push({
                success: true,
                userId: existingUser.id,
                email: user.email,
              });
              console.log(`  ✓ Updated existing user\n`);
            }
          } else {
            throw createError;
          }
        } else if (authUser) {
          // Send password reset email
          const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(user.email, {
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
          });

          if (resetError) {
            console.warn(`  Warning: Failed to send password reset email: ${resetError.message}`);
          } else {
            console.log(`  Password reset email sent`);
          }

          // Update the user ID in the existing database to match Supabase Auth ID
          await prisma.user.update({
            where: { id: user.id },
            data: { id: authUser.user.id },
          });

          results.push({
            success: true,
            userId: authUser.user.id,
            email: user.email,
          });

          console.log(`  ✓ Successfully migrated\n`);
        }
      } catch (error) {
        console.error(
          `  ✗ Failed to migrate: ${error instanceof Error ? error.message : 'Unknown error'}\n`
        );
        results.push({
          success: false,
          userId: user.id,
          email: user.email,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Print summary
    console.log('\n========================================');
    console.log('Migration Summary');
    console.log('========================================');
    console.log(`Total users: ${users.length}`);
    console.log(`Successfully migrated: ${results.filter((r) => r.success).length}`);
    console.log(`Failed: ${results.filter((r) => !r.success).length}`);

    if (results.some((r) => !r.success)) {
      console.log('\nFailed migrations:');
      results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`  - ${r.email}: ${r.error}`);
        });
    }

    // Save migration results to file
    const fs = await import('fs');
    const path = await import('path');
    const resultsPath = path.join(process.cwd(), 'migration-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\nMigration results saved to: ${resultsPath}`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateUsers()
  .then(() => {
    console.log('\nMigration completed successfully!');
    console.log('Please inform users to check their email for password reset instructions.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
