// Simple script to create a test user via API
// Run with: node scripts/create-test-user.js

async function createTestUser() {
  const apiUrl = 'http://localhost:3001/api/v1';

  try {
    // First, let's check if API is running
    const healthResponse = await fetch(`${apiUrl}/`);
    console.log('API Health check:', healthResponse.status);

    // Register user
    const registerResponse = await fetch(`${apiUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password:
          process.env.TEST_USER_PASSWORD || `test${Math.random().toString(36).substring(2, 15)}`,
        name: 'Test User',
      }),
    });

    const registerData = await registerResponse.json();
    console.log('Register response:', registerData);

    if (registerResponse.ok) {
      console.log('✅ Test user created successfully!');
      console.log('Email: test@example.com');
      console.log('Password: password123');
    } else {
      console.error('❌ Failed to create user:', registerData.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('Make sure the API server is running on port 3001');
  }
}

createTestUser();
