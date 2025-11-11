/**
 * Local Login Test
 *
 * Tests the local login flow to reproduce the production issue
 * - Tests cookie storage behavior
 * - Verifies session persistence
 * - Captures console logs for debugging
 */

import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:3000';
const TEST_EMAIL = 'admin@test.localhost';
const TEST_PASSWORD = 'Test1234!';

test.describe('Local Login Test', () => {
  test('should login and persist session', async ({ page }) => {
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

    // Step 1: Navigate to login page
    console.log('\n📍 Step 1: Navigating to login page...');
    await page.goto(`${LOCAL_URL}/auth/login`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    console.log('✅ Login page loaded');

    // Step 2: Fill in login form
    console.log('\n📍 Step 2: Filling in login form...');
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    console.log(`✅ Login form filled (email: ${TEST_EMAIL})`);

    // Step 3: Submit login form
    console.log('\n📍 Step 3: Submitting login form...');
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    console.log('✅ Login form submitted');

    // Step 4: Wait for response
    console.log('\n📍 Step 4: Waiting for login to complete...');
    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    console.log(`\n📍 Current URL after login: ${currentUrl}`);

    // Check if we're redirected (login successful)
    const isRedirected =
      currentUrl.includes('/dashboard') || currentUrl.includes('/select-organization');

    if (isRedirected) {
      console.log('✅ Login successful! Redirected to:', currentUrl);

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

      // Check for visible error messages (exclude Next.js route announcer)
      const errorElement = page.locator(
        '[role="alert"]:not(#__next-route-announcer__), .error-message'
      );
      const errorCount = await errorElement.count();
      if (errorCount > 0) {
        const errorMessage = await errorElement.first().textContent();
        console.log(`\n❌ Visible error: ${errorMessage}`);
      }
    }

    // Take screenshot
    await page.screenshot({ path: '/tmp/local-login-test.png', fullPage: true });
    console.log('📸 Screenshot saved to /tmp/local-login-test.png');

    // Print summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Test email: ${TEST_EMAIL}`);
    console.log(`Final URL:  ${currentUrl}`);
    console.log(`Login success: ${isRedirected ? 'YES ✅' : 'NO ❌'}`);
    console.log(`Total console logs: ${consoleLogs.length}`);
  });
});
