async function testLogin() {
  const credentials = [
    { email: 'digol.348659@gensan.sti.edu.ph', password: '@STIgensan12345' },
    { email: 'mdigol19@mail.com', password: '@Md12345678' }
  ];

  for (const cred of credentials) {
    console.log(`Testing login for: ${cred.email}`);
    try {
      const res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cred)
      });
      const data = await res.json();
      console.log(`Status: ${res.status}`);
      console.log('Response:', data);
    } catch (e) {
      console.error('Fetch error:', e);
    }
    console.log('---------------------------');
  }
}
testLogin();
