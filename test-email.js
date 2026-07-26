// Quick email test — run with: node test-email.js
require('dotenv').config();
const nodemailer = require('nodemailer');

const user = process.env.SMTP_USER || 'biharyaatraofficial@gmail.com';
const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
const to   = process.env.SMTP_USER; // send to self as test

console.log('SMTP_USER:', user);
console.log('SMTP_PASS set:', !!pass, pass ? `(${pass.length} chars)` : '');

if (!pass) {
  console.error('❌ SMTP_PASS not set in .env — cannot test');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user, pass },
});

transporter.verify((err, success) => {
  if (err) {
    console.error('❌ SMTP verify failed:', err.message);
    console.error('\nCommon fixes:');
    console.error('  1. Make sure 2-Step Verification is ON for the Gmail account');
    console.error('  2. Generate a new App Password at: https://myaccount.google.com/apppasswords');
    console.error('  3. The app password is 16 chars with no spaces, e.g. "abcdabcdabcdabcd"');
    process.exit(1);
  }

  console.log('✓ SMTP connection verified. Sending test email...');
  transporter.sendMail(
    {
      from: `"Bihar Yaatra Test" <${user}>`,
      to,
      subject: 'Bihar Yaatra — SMTP Test',
      text: 'If you receive this, SMTP is working correctly!',
      html: '<b>✅ SMTP is working!</b><p>OTP emails will now be delivered.</p>',
    },
    (err2, info) => {
      if (err2) {
        console.error('❌ Send failed:', err2.message);
        process.exit(1);
      }
      console.log('✅ Test email sent! Message ID:', info.messageId);
      console.log('Check your inbox at:', to);
    }
  );
});
