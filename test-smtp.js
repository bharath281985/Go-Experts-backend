import nodemailer from 'nodemailer';

const host = 'mail.goexperts.in';
const port = 465;
const user = 'support@goexperts.in';
const pass = 'Goexperts@2025';
const fromEmail = 'support@goexperts.in';

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: true,
  auth: { user, pass },
  tls: { rejectUnauthorized: false },
});

async function test() {
  try {
    const info = await transporter.sendMail({
      from: `"Go Experts" <${fromEmail}>`,
      to: 'thatipallyvinod@gmail.com',
      subject: 'Test Email from Go Experts',
      text: 'This is a test email.',
    });
    console.log('Success!', info.messageId);
  } catch (err) {
    console.error('Failed!', err);
  }
}

test();
