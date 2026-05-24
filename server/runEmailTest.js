require('dotenv').config();
const { sendSmtpTestEmail } = require('./mailer');

async function runTest() {
  console.log('Testing SMTP connection with credentials:', process.env.SMTP_USER);
  const result = await sendSmtpTestEmail({
    to: process.env.SMTP_USER,
    userId: null
  });
  
  if (result.sent) {
    console.log('✅ SUCCESS: Test email sent successfully!');
  } else {
    console.log('❌ FAILED: Could not send email.');
    console.log('Reason:', result.reason);
  }
  process.exit();
}

runTest();
