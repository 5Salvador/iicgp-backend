import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000/api';
let token = '';

async function testAuth() {
  console.log('--- Testing Authentication ---');

  // 1. Register
  console.log('1. Registering new admin...');
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testadmin', password: 'password123' })
  });
  if (regRes.status === 201 || regRes.status === 400) { // 400 if already exists
    console.log('   Register success or already exists.');
  } else {
    console.log('   Register failed:', await regRes.text());
  }

  // 2. Login
  console.log('2. Logging in...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testadmin', password: 'password123' })
  });
  const loginData = await loginRes.json();
  if (loginRes.ok) {
    token = loginData.token;
    console.log('   Login successful. Token received.');
  } else {
    console.error('   Login failed:', loginData);
    return;
  }

  // 3. Try to create event WITHOUT token
  console.log('3. Creating event WITHOUT token (expecting failure)...');
  const failRes = await fetch(`${BASE_URL}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Unauthorized Event' })
  });
  if (failRes.status === 401 || failRes.status === 400) { // 400 if middleware catches "Token invalid"
     console.log('   Correctly denied access.');
  } else {
     console.log('   Unexpected status:', failRes.status);
  }

  // 4. Try to create event WITH token
  console.log('4. Creating event WITH token (expecting success)...');
  const successRes = await fetch(`${BASE_URL}/events`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ 
      title: 'Authorized Test Event',
      date: { month: 12, day: 25 },
      description: 'Test' 
    })
  });
  
  if (successRes.status === 201) {
    console.log('   Event created successfully.');
    // Cleanup
    const event = await successRes.json();
    await fetch(`${BASE_URL}/events/${event._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('   Test event deleted.');
  } else {
    console.log('   Failed to create event:', await successRes.text());
  }
}

testAuth();
