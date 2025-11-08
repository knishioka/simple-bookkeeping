/**
 * Production Login Test with Console Log Capture
 *
 * This script tests the production login flow and captures all console logs
 * to debug the authentication redirect loop issue.
 */

import { chromium } from 'playwright';

const PRODUCTION_URL = 'https://simple-bookkeeping-g6464lpil-knishioka.vercel.app';
const TEST_EMAIL = 'admin@test.localhost';
const TEST_PASSWORD = 'Test1234!';

async function testProductionLogin() {
  console.log('🚀 Starting production login test...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });

  const page = await context.newPage();

  // Collect all console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    const location = msg.location();

    consoleLogs.push({
      type,
      text,
      location: `${location.url}:${location.lineNumber}:${location.columnNumber}`
    });

    // Print immediately for real-time monitoring
    const icon = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'log' ? '📝' : 'ℹ️';
    console.log(`${icon} [${type.toUpperCase()}] ${text}`);
  });

  // Track page errors
  page.on('pageerror', error => {
    console.error('❌ PAGE ERROR:', error.message);
    consoleLogs.push({
      type: 'pageerror',
      text: error.message,
      location: 'page'
    });
  });

  // Track network requests
  const requests = [];
  page.on('request', request => {
    if (request.url().includes('/api/auth/signin') || request.url().includes('supabase')) {
      requests.push({
        method: request.method(),
        url: request.url(),
        headers: request.headers()
      });
    }
  });

  // Track network responses
  const responses = [];
  page.on('response', async response => {
    if (response.url().includes('/api/auth/signin') || response.url().includes('supabase')) {
      const headers = response.headers();
      responses.push({
        status: response.status(),
        url: response.url(),
        headers,
        setCookie: headers['set-cookie'] || 'Not present'
      });
    }
  });

  try {
    // Step 1: Navigate to login page
    console.log('\n📍 Step 1: Navigating to login page...');
    await page.goto(`${PRODUCTION_URL}/auth/login`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    console.log('✅ Login page loaded');

    // Step 2: Fill in credentials
    console.log('\n📍 Step 2: Filling in credentials...');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    console.log('✅ Credentials filled');

    // Step 3: Submit login form
    console.log('\n📍 Step 3: Submitting login form...');
    await page.click('button[type="submit"]');
    console.log('✅ Login form submitted');

    // Step 4: Wait for navigation or error
    console.log('\n📍 Step 4: Waiting for response...');

    // Wait for either successful redirect or error message
    await page.waitForTimeout(5000);

    // Check current URL
    const currentUrl = page.url();
    console.log(`\n📍 Current URL: ${currentUrl}`);

    // Check cookies
    const cookies = await context.cookies();
    console.log(`\n🍪 Cookies (${cookies.length} total):`);
    cookies.forEach(cookie => {
      if (cookie.name.startsWith('sb-') || cookie.name.startsWith('supabase-')) {
        console.log(`  - ${cookie.name}: ${cookie.value.substring(0, 50)}... (${cookie.value.length} chars)`);
      }
    });

    // Wait a bit more to see if redirect happens
    console.log('\n📍 Waiting 10 seconds to observe behavior...');
    await page.waitForTimeout(10000);

    const finalUrl = page.url();
    console.log(`\n📍 Final URL after 10s: ${finalUrl}`);

    // Take screenshot
    await page.screenshot({ path: '/tmp/production-login-test.png', fullPage: true });
    console.log('📸 Screenshot saved to /tmp/production-login-test.png');

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Initial URL: ${PRODUCTION_URL}/auth/login`);
    console.log(`Current URL: ${currentUrl}`);
    console.log(`Final URL:   ${finalUrl}`);
    console.log(`Total console logs: ${consoleLogs.length}`);
    console.log(`Supabase cookies: ${cookies.filter(c => c.name.startsWith('sb-')).length}`);
    console.log(`Auth requests: ${requests.length}`);
    console.log(`Auth responses: ${responses.length}`);

    // Print relevant logs
    console.log('\n' + '='.repeat(80));
    console.log('📝 RELEVANT CONSOLE LOGS');
    console.log('='.repeat(80));
    const relevantLogs = consoleLogs.filter(log =>
      log.text.includes('[LoginPage]') ||
      log.text.includes('[SignIn Route]') ||
      log.text.includes('[Middleware]')
    );

    if (relevantLogs.length > 0) {
      relevantLogs.forEach(log => {
        console.log(`[${log.type}] ${log.text}`);
      });
    } else {
      console.log('⚠️ No relevant logs found! This suggests console.log is still not outputting.');
    }

    // Print network activity
    console.log('\n' + '='.repeat(80));
    console.log('🌐 NETWORK ACTIVITY');
    console.log('='.repeat(80));

    if (responses.length > 0) {
      responses.forEach(resp => {
        console.log(`\n${resp.status} ${resp.url}`);
        console.log(`Set-Cookie: ${resp.setCookie}`);
      });
    } else {
      console.log('⚠️ No auth-related responses captured');
    }

  } catch (error) {
    console.error('\n❌ ERROR during test:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

// Run the test
testProductionLogin().catch(console.error);
