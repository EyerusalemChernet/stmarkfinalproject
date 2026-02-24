/**
 * Quick API test script
 * Tests health endpoint and login functionality
 */

const BASE_URL = 'http://localhost:3001';

async function testHealthEndpoint() {
  console.log('\n🔍 Testing Health Endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ Health check passed');
      console.log('   Database:', data.data.database);
      console.log('   Timestamp:', data.data.timestamp);
      return true;
    } else {
      console.log('❌ Health check failed:', data);
      return false;
    }
  } catch (error) {
    console.log('❌ Health check error:', error.message);
    return false;
  }
}

async function testLogin() {
  console.log('\n🔍 Testing Login Endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@school.edu',
        password: 'Admin@123',
      }),
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ Login successful');
      console.log('   User:', data.data.user.email);
      console.log('   Roles:', data.data.user.roles.join(', '));
      console.log('   Token received:', data.data.accessToken ? 'Yes' : 'No');
      return data.data.accessToken;
    } else {
      console.log('❌ Login failed:', data);
      return null;
    }
  } catch (error) {
    console.log('❌ Login error:', error.message);
    return null;
  }
}

async function testProtectedEndpoint(token) {
  console.log('\n🔍 Testing Protected Endpoint (Users List)...');
  try {
    const response = await fetch(`${BASE_URL}/api/users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ Protected endpoint accessible');
      console.log('   Users found:', data.data.length);
      return true;
    } else {
      console.log('❌ Protected endpoint failed:', data);
      return false;
    }
  } catch (error) {
    console.log('❌ Protected endpoint error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════');
  console.log('  School Management System - API Tests');
  console.log('═══════════════════════════════════════════');
  
  const healthOk = await testHealthEndpoint();
  
  if (!healthOk) {
    console.log('\n❌ Health check failed. Make sure the server is running on port 3001');
    console.log('   Run: npm run dev');
    return;
  }
  
  const token = await testLogin();
  
  if (!token) {
    console.log('\n❌ Login failed. Cannot test protected endpoints.');
    return;
  }
  
  await testProtectedEndpoint(token);
  
  console.log('\n═══════════════════════════════════════════');
  console.log('  ✅ All tests completed!');
  console.log('═══════════════════════════════════════════\n');
}

runTests();
