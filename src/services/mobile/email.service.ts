import nodemailer from 'nodemailer';

const host = process.env.SMTP_HOST || 'mail.goexperts.in';
const port = parseInt(process.env.SMTP_PORT || '465');
const user = process.env.SMTP_USER || 'support@goexperts.in';
const pass = process.env.SMTP_PASS || 'Goexperts@2025';
const fromEmail = process.env.SMTP_FROM || 'support@goexperts.in';

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
  tls: {
    rejectUnauthorized: false,
  },
});

export const sendEmail = async (to: string, subject: string, html: string): Promise<boolean> => {
  try {
    const info = await transporter.sendMail({
      from: `"Go Experts Support" <${fromEmail}>`,
      to,
      subject,
      html,
    });
    console.log(`[EMAIL SENT SUCCESS] To: ${to} | Subject: "${subject}" | MessageId: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL ERROR FAILED] Failed to send email to ${to}:`, error);
    return false;
  }
};

export const sendWelcomeEmail = (to: string, name: string) => {
  const html = `<h1>Welcome to Go Experts, ${name}!</h1><p>We're glad to have you on board.</p>`;
  return sendEmail(to, 'Welcome to Go Experts', html);
};

export const sendPasswordResetEmail = (to: string, token: string) => {
  const html = `<p>You requested a password reset. Use this token: <strong>${token}</strong></p>`;
  return sendEmail(to, 'Password Reset Request', html);
};

export const sendVerificationEmail = (to: string, token: string) => {
  console.log(`\n======================================================================`);
  console.log(`🔑 [MOBILE OTP DISPATCH]`);
  console.log(`   Recipient: ${to}`);
  console.log(`   OTP Code:  ${token}`);
  console.log(`======================================================================\n`);
  const html = `<p>Please verify your email using this token: <strong>${token}</strong></p>`;
  return sendEmail(to, 'Email Verification', html);
};
