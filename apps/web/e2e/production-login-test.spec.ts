/**
 * Production Login Test
 *
 * Tests the production login flow and captures console logs
 * to debug the authentication redirect loop issue.
 */

import { test, expect } from '@playwright/test';

const PRODUCTION_URL = 'https://simple-bookkeeping-jp.vercel.app';
const TEST_EMAIL = 'admin@test.localhost';
const TEST_PASSWORD = 'Test1234!';

test.describe('Production Login Debug', () => {
  test('should capture console logs during login', async ({ page }) => {
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
    await page.goto(`${PRODUCTION_URL}/auth/login`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    console.log('✅ Login page loaded');

    // Step 2: Fill in credentials
    console.log('\n📍 Step 2: Filling in credentials...');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    console.log('✅ Credentials filled');

    // Step 3: Submit login form
    console.log('\n📍 Step 3: Submitting login form...');
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    console.log('✅ Login form submitted');

    // Step 4: Wait and observe behavior
    console.log('\n📍 Step 4: Waiting for response...');
    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    console.log(`\n📍 Current URL after 5s: ${currentUrl}`);

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

    // Wait more to observe redirects
    console.log('\n📍 Waiting additional 10 seconds...');
    await page.waitForTimeout(10000);

    const finalUrl = page.url();
    console.log(`\n📍 Final URL after 15s total: ${finalUrl}`);

    // Take screenshot
    await page.screenshot({ path: '/tmp/production-login-test.png', fullPage: true });
    console.log('📸 Screenshot saved to /tmp/production-login-test.png');

    // Print summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Initial URL: ${PRODUCTION_URL}/auth/login`);
    console.log(`After submit: ${currentUrl}`);
    console.log(`Final URL:   ${finalUrl}`);
    console.log(`Total console logs: ${consoleLogs.length}`);
    console.log(`Supabase cookies: ${supabaseCookies.length}`);

    // Print relevant logs
    console.log(`\n${'='.repeat(80)}`);
    console.log('📝 RELEVANT CONSOLE LOGS');
    console.log('='.repeat(80));

    const relevantLogs = consoleLogs.filter(
      (log) =>
        log.text.includes('[LoginPage]') ||
        log.text.includes('[SignIn Route]') ||
        log.text.includes('[Middleware]')
    );

    if (relevantLogs.length > 0) {
      relevantLogs.forEach((log) => {
        console.log(`[${log.type}] ${log.text}`);
      });
    } else {
      console.log(
        '⚠️ No debug logs found with [LoginPage], [SignIn Route], or [Middleware] prefix'
      );
      console.log('\n📝 ALL CONSOLE LOGS:');
      consoleLogs.forEach((log) => {
        console.log(`[${log.type}] ${log.text}`);
      });
    }

    // Assertions
    expect(consoleLogs.length).toBeGreaterThan(0);
  });
});
