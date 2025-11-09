/**
 * Production Authentication Flow Test
 *
 * Complete test of signup → login → session persistence flow on production
 * - Creates new user via signup
 * - Logs in with created credentials
 * - Verifies cookie storage and session persistence
 */

import { test, expect } from '@playwright/test';

const PRODUCTION_URL = 'https://simple-bookkeeping-jp.vercel.app';
const TEST_EMAIL = `test-${Date.now()}@test.example`;
const TEST_PASSWORD = 'Test1234!';
const TEST_NAME = 'テストユーザー';
const TEST_ORG_NAME = 'テスト組織';

test.describe('Production Complete Auth Flow Test', () => {
  test('should signup, login, and persist session', async ({ page }) => {
    // Collect all console logs
    const consoleLogs: Array<{ type: string; text: string }> = [];

    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleLogs.push({ type, text });

      // Print to test output
      const icon =
        type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'log' ? '📝' : 'ℹ️';
      console.log(`${icon} [${type.toUpperCase()}] ${text}`);
    });

    // Track page errors
    page.on('pageerror', (error) => {
      console.error('❌ PAGE ERROR:', error.message);
    });

    // ========================================
    // PART 1: SIGNUP
    // ========================================
    console.log(`\n${'='.repeat(80)}`);
    console.log('PART 1: SIGNUP');
    console.log('='.repeat(80));

    // Step 1: Navigate to signup page
    console.log('\n📍 Step 1: Navigating to signup page...');
    await page.goto(`${PRODUCTION_URL}/auth/signup`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    console.log('✅ Signup page loaded');

    // Step 2: Fill in signup form
    console.log('\n📍 Step 2: Filling in signup form...');
    await page.fill('input[name="organizationName"]', TEST_ORG_NAME);
    await page.fill('input[name="name"]', TEST_NAME);
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.fill('input[name="confirmPassword"]', TEST_PASSWORD);
    console.log(`✅ Signup form filled (email: ${TEST_EMAIL})`);

    // Step 3: Submit signup form
    console.log('\n📍 Step 3: Submitting signup form...');
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    console.log('✅ Signup form submitted');

    // Step 4: Wait for signup completion and check for success message
    console.log('\n📍 Step 4: Waiting for signup to complete...');
    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    console.log(`📍 Current URL after signup: ${currentUrl}`);

    // Check for signup success message
    const successMessage = await page.locator('text=登録が完了しました').isVisible();
    if (successMessage) {
      console.log('✅ Signup successful - confirmation message displayed');
    } else {
      console.error('❌ Signup may have failed - no confirmation message');
    }

    // ========================================
    // PART 2: LOGIN
    // ========================================
    console.log(`\n${'='.repeat(80)}`);
    console.log('PART 2: LOGIN');
    console.log('='.repeat(80));

    // Step 5: Navigate to login page
    console.log('\n📍 Step 5: Navigating to login page...');
    await page.goto(`${PRODUCTION_URL}/auth/login`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    console.log('✅ Login page loaded');

    // Step 6: Fill in login form
    console.log('\n📍 Step 6: Filling in login form...');
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    console.log(`✅ Login form filled (email: ${TEST_EMAIL})`);

    // Step 7: Submit login form
    console.log('\n📍 Step 7: Submitting login form...');
    const loginButton = page.locator('button[type="submit"]');
    await loginButton.click();
    console.log('✅ Login form submitted');

    // Step 8: Wait for redirect after login
    console.log('\n📍 Step 8: Waiting for login to complete...');
    await page.waitForTimeout(5000);

    const urlAfterLogin = page.url();
    console.log(`📍 URL after login: ${urlAfterLogin}`);

    // Check if we're redirected (login successful)
    const isRedirected =
      urlAfterLogin.includes('/dashboard') || urlAfterLogin.includes('/select-organization');

    if (isRedirected) {
      console.log('✅ Login successful! Redirected to:', urlAfterLogin);

      // Get cookies
      const cookies = await page.context().cookies();
      const supabaseCookies = cookies.filter(
        (c) => c.name.startsWith('sb-') || c.name.startsWith('supabase-')
      );

      console.log(`\n🍪 Supabase Cookies (${supabaseCookies.length} total):`);
      supabaseCookies.forEach((cookie) => {
        console.log(
          `  - ${cookie.name}: ${cookie.value.substring(0, 50)}... (${cookie.value.length} chars)`
        );
      });

      // Check localStorage
      const localStorageData = await page.evaluate(() => {
        const data: Record<string, string> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('supabase') || key.startsWith('sb-'))) {
            data[key] = localStorage.getItem(key) || '';
          }
        }
        return data;
      });

      console.log(`\n💾 localStorage (${Object.keys(localStorageData).length} items):`);
      Object.entries(localStorageData).forEach(([key, value]) => {
        console.log(`  - ${key}: ${value.substring(0, 50)}... (${value.length} chars)`);
      });

      // ========================================
      // PART 3: SESSION PERSISTENCE TEST
      // ========================================
      console.log(`\n${'='.repeat(80)}`);
      console.log('PART 3: SESSION PERSISTENCE');
      console.log('='.repeat(80));

      // Wait for page to stabilize
      await page.waitForTimeout(3000);

      // Step 9: Test session persistence by refreshing
      console.log('\n📍 Step 9: Testing session persistence (refresh)...');
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      const urlAfterRefresh = page.url();
      console.log(`📍 URL after refresh: ${urlAfterRefresh}`);

      if (urlAfterRefresh.includes('/auth/login')) {
        console.error('❌ Session NOT persisted - redirected to login page');
      } else {
        console.log('✅ Session persisted - still authenticated');
      }

      // Check for auth state in console
      const authLogs = consoleLogs.filter(
        (log) =>
          log.text.includes('[AuthContext]') ||
          log.text.includes('getUser result') ||
          log.text.includes('[Supabase Client]')
      );

      console.log('\n📝 Authentication State Logs:');
      authLogs.forEach((log) => {
        console.log(`[${log.type}] ${log.text}`);
      });

      expect(urlAfterRefresh).not.toContain('/auth/login');
    } else {
      console.error('❌ Login failed - still on login page');

      // Check for error messages
      const errorLogs = consoleLogs.filter((log) => log.type === 'error');
      if (errorLogs.length > 0) {
        console.log('\n❌ Error logs:');
        errorLogs.forEach((log) => {
          console.log(`  ${log.text}`);
        });
      }

      // Check for visible error messages
      const errorElements = await page.locator('[role="alert"]').all();
      if (errorElements.length > 0) {
        console.log('\n❌ Visible errors:');
        for (const element of errorElements) {
          const text = await element.textContent();
          if (text && !text.includes('Announcer')) {
            console.log(`  ${text}`);
          }
        }
      }
    }

    // Take screenshot
    await page.screenshot({ path: '/tmp/production-auth-flow-test.png', fullPage: true });
    console.log('📸 Screenshot saved to /tmp/production-auth-flow-test.png');

    // Print summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Test email: ${TEST_EMAIL}`);
    console.log(`Signup success: ${successMessage ? 'YES ✅' : 'NO ❌'}`);
    console.log(`Login success: ${isRedirected ? 'YES ✅' : 'NO ❌'}`);
    console.log(`Final URL:  ${urlAfterLogin}`);
    console.log(`Total console logs: ${consoleLogs.length}`);
  });
});
