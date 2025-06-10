// Basic E2E test to verify frontend pages are working
// Run with: node scripts/e2e-basic-test.js

async function testFrontendPages() {
  console.log('🧪 Testing frontend pages...\n');
  
  const testPages = [
    { url: 'http://localhost:3000', name: 'Landing Page' },
    { url: 'http://localhost:3000/demo', name: 'Demo Overview' },
    { url: 'http://localhost:3000/demo/accounts', name: 'Accounts Demo' },
    { url: 'http://localhost:3000/demo/journal-entries', name: 'Journal Entries Demo' },
  ];

  let allPassed = true;

  for (const page of testPages) {
    try {
      console.log(`Testing ${page.name} (${page.url})...`);
      
      const response = await fetch(page.url);
      
      if (response.ok) {
        const text = await response.text();
        
        // Basic checks for expected content
        const checks = {
          'Landing Page': ['Simple Bookkeeping', '複式簿記'],
          'Demo Overview': ['機能デモ', '勘定科目管理', '仕訳入力'],
          'Accounts Demo': ['勘定科目管理', 'デモページ', '新規作成'],
          'Journal Entries Demo': ['仕訳入力', 'デモページ', '仕訳一覧'],
        };
        
        const expectedContent = checks[page.name] || [];
        const missingContent = expectedContent.filter(content => !text.includes(content));
        
        if (missingContent.length === 0) {
          console.log(`✅ ${page.name}: PASSED`);
        } else {
          console.log(`❌ ${page.name}: FAILED - Missing content: ${missingContent.join(', ')}`);
          allPassed = false;
        }
      } else {
        console.log(`❌ ${page.name}: FAILED - HTTP ${response.status}`);
        allPassed = false;
      }
    } catch (error) {
      console.log(`❌ ${page.name}: FAILED - ${error.message}`);
      allPassed = false;
    }
    
    console.log('');
  }

  console.log('📊 Test Summary:');
  console.log(`Status: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log(`Frontend server: ${allPassed ? 'Working correctly' : 'Has issues'}`);
  
  if (allPassed) {
    console.log('\n🎉 Frontend E2E verification successful!');
    console.log('All demo pages are accessible and contain expected content.');
  } else {
    console.log('\n⚠️  Some frontend pages have issues.');
    console.log('Please check the server logs and page content.');
  }
  
  return allPassed;
}

// Test API server basic functionality
async function testApiServer() {
  console.log('\n🔧 Testing API server...\n');
  
  try {
    const response = await fetch('http://localhost:3001/api/v1/');
    
    if (response.ok) {
      const data = await response.json();
      if (data.message && data.message.includes('Simple Bookkeeping API')) {
        console.log('✅ API Server: PASSED - Server is responding');
        return true;
      } else {
        console.log('❌ API Server: FAILED - Unexpected response format');
        return false;
      }
    } else {
      console.log(`❌ API Server: FAILED - HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ API Server: NOT RUNNING - ${error.message}`);
    console.log('Note: API server is not required for demo pages to work');
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Basic E2E Verification\n');
  console.log('This test verifies that the frontend demo pages are working correctly.\n');
  
  const frontendWorking = await testFrontendPages();
  const apiWorking = await testApiServer();
  
  console.log('\n' + '='.repeat(60));
  console.log('FINAL RESULTS:');
  console.log(`Frontend Demo Pages: ${frontendWorking ? '✅ WORKING' : '❌ ISSUES'}`);
  console.log(`API Server: ${apiWorking ? '✅ WORKING' : '❌ NOT RUNNING'}`);
  console.log('='.repeat(60));
  
  if (frontendWorking) {
    console.log('\n✅ E2E Verification: SUCCESSFUL');
    console.log('The frontend application is working correctly.');
    console.log('Users can view demo pages and test all implemented features.');
  } else {
    console.log('\n❌ E2E Verification: FAILED');
    console.log('There are issues with the frontend application.');
  }
}

runTests().catch(console.error);