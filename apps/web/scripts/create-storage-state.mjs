#!/usr/bin/env node

// Generates a mock authenticated Playwright storage state that matches the
// Supabase configuration used in CI.
// This script is executed from GitHub Actions (reusable-setup.yml) and can
// also be run locally to pre-create authentication state for E2E tests.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);

const APP_ROOT = path.resolve(scriptDir, '..');
const AUTH_DIR = path.join(APP_ROOT, 'e2e', '.auth');
const STORAGE_STATE_FILENAME = 'authenticated.json';
const STORAGE_STATE_PATH = path.join(AUTH_DIR, STORAGE_STATE_FILENAME);

const ROLE_FILENAMES = ['admin.json', 'accountant.json', 'viewer.json'];

const SHARED_DIR = path.join(AUTH_DIR, 'shared');

function getSupabaseProjectRef() {
  const fallbackUrl = 'http://localhost:8000';
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl;

  try {
    const { hostname } = new URL(rawUrl);
    if (!hostname) {
      return 'placeholder';
    }

    // For hosts like placeholder.supabase.co we only need the first segment.
    const segments = hostname.split('.');
    return segments[0] || 'placeholder';
  } catch (error) {
    console.warn('[create-storage-state] Failed to parse NEXT_PUBLIC_SUPABASE_URL:', error);
    return 'placeholder';
  }
}

function buildMockSession() {
  const now = Date.now();
  const expiresAt = Math.floor(now / 1000) + 3600; // 1 hour

  return {
    access_token: `mock-access-token-${now}`,
    refresh_token: `mock-refresh-token-${now}`,
    expires_at: expiresAt,
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'test-user-id',
      email: 'admin.e2e@test.localhost',
      user_metadata: {
        name: 'E2E Test Admin',
        organization_id: 'test-org-e2e-001',
        role: 'admin',
        permissions: ['*'],
      },
    },
  };
}

function buildStorageState(session, projectRef) {
  const authEntry = {
    currentSession: session,
    expiresAt: session.expires_at,
  };

  const localStorageEntries = [
    {
      name: `sb-${projectRef}-auth-token`,
      value: JSON.stringify(authEntry),
    },
    // Maintain backward compatibility with placeholder key (used in legacy tests)
    {
      name: 'sb-placeholder-auth-token',
      value: JSON.stringify(authEntry),
    },
    {
      name: 'supabase.auth.token',
      value: JSON.stringify(authEntry),
    },
    {
      name: 'mockAuth',
      value: 'true',
    },
    {
      name: 'selectedOrganizationId',
      value: 'test-org-e2e-001',
    },
  ];

  const origins = [
    {
      origin: 'http://localhost:3000',
      localStorage: localStorageEntries,
    },
    {
      origin: 'http://127.0.0.1:3000',
      localStorage: localStorageEntries,
    },
  ];

  const cookieExpires = session.expires_at;

  const cookies = [
    {
      name: 'mockAuth',
      value: 'true',
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
      expires: cookieExpires,
    },
    {
      name: 'mockAuth',
      value: 'true',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
      expires: cookieExpires,
    },
  ];

  return {
    cookies,
    origins,
  };
}

function main() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.mkdirSync(SHARED_DIR, { recursive: true });

  const projectRef = getSupabaseProjectRef();
  const session = buildMockSession();
  const storageState = buildStorageState(session, projectRef);

  const payload = JSON.stringify(storageState, null, 2);

  // Primary storage-state file used by Playwright projects
  fs.writeFileSync(STORAGE_STATE_PATH, payload);

  // Role-based files consumed by legacy helpers (admin/accountant/viewer)
  for (const roleFilename of ROLE_FILENAMES) {
    const rolePath = path.join(AUTH_DIR, roleFilename);
    fs.writeFileSync(rolePath, payload);
    // Mirror under shared/ for sharded CI compatibility
    fs.writeFileSync(path.join(SHARED_DIR, roleFilename), payload);
  }

  console.log('✅ Storage State created');
  console.log('   Path:', STORAGE_STATE_PATH);
  console.log('   Role paths:', ROLE_FILENAMES.map((file) => path.join('e2e/.auth', file)).join(', '));
  console.log('   Shared dir:', path.join('e2e/.auth', 'shared'));
  console.log('   Supabase project ref:', projectRef);
}

main();
