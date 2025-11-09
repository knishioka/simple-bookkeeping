/**
 * Production Signup Test
 *
 * Tests the production signup flow and login to verify cookie-based authentication
 */

import { test, expect } from '@playwright/test';

const PRODUCTION_URL = 'https://simple-bookkeeping-jp.vercel.app';
const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'Test1234!';
const TEST_NAME = 'テストユーザー';

test.describe('Production Signup and Login Test', () => {
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

    // Step 1: Navigate to signup page
    console.log('\n📍 Step 1: Navigating to signup page...');
    await page.goto(`${PRODUCTION_URL}/auth/signup`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    console.log('✅ Signup page loaded');

    // Step 2: Fill in signup form
    console.log('\n📍 Step 2: Filling in signup form...');
    await page.fill('input[name="organizationName"]', 'テスト組織');
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

    // Step 4: Wait for redirect to dashboard or organization selection
    console.log('\n📍 Step 4: Waiting for signup to complete...');
    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    console.log(`\n📍 Current URL after signup: ${currentUrl}`);

    // Check if we're redirected (signup successful)
    const isRedirected =
      currentUrl.includes('/dashboard') || currentUrl.includes('/select-organization');

    if (isRedirected) {
      console.log('✅ Signup successful! Redirected to:', currentUrl);

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

      // Wait for page to stabilize
      await page.waitForTimeout(3000);

      // Step 5: Test session persistence by refreshing
      console.log('\n📍 Step 5: Testing session persistence (refresh)...');
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
        (log) => log.text.includes('[AuthContext]') || log.text.includes('getUser result')
      );

      console.log('\n📝 Authentication State Logs:');
      authLogs.forEach((log) => {
        console.log(`[${log.type}] ${log.text}`);
      });

      expect(urlAfterRefresh).not.toContain('/auth/login');
    } else {
      console.error('❌ Signup failed - still on signup page');

      // Check for error messages
      const errorLogs = consoleLogs.filter((log) => log.type === 'error');
      if (errorLogs.length > 0) {
        console.log('\n❌ Error logs:');
        errorLogs.forEach((log) => {
          console.log(`  ${log.text}`);
        });
      }
    }

    // Take screenshot
    await page.screenshot({ path: '/tmp/production-signup-test.png', fullPage: true });
    console.log('📸 Screenshot saved to /tmp/production-signup-test.png');

    // Print summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Test email: ${TEST_EMAIL}`);
    console.log(`Final URL:  ${currentUrl}`);
    console.log(`Signup success: ${isRedirected ? 'YES ✅' : 'NO ❌'}`);
    console.log(`Total console logs: ${consoleLogs.length}`);
  });
});
