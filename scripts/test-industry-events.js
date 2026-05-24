async function test() {
  try {
    const login = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'industrytest@psits.com', password: '@Industry123' })
    });
    const loginData = await login.json();
    const token = loginData.token;

    const events = await fetch('http://localhost:3000/api/events', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const eventsData = await events.json();
    console.log('Events length:', eventsData.events ? eventsData.events.length : 0);

    const myEvents = await fetch('http://localhost:3000/api/events/registrations/my', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const myEventsData = await myEvents.json();
    console.log('My Events:', myEventsData);

  } catch (err) {
    console.error('Error:', err);
  }
}
test();
