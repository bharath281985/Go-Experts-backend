import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT || '2525'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const fromEmail = process.env.SMTP_FROM || 'noreply@goexperts.in';

export const sendEmail = async (to: string, subject: string, html: string): Promise<boolean> => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[DEV MODE] Email skipped. To: ${to}, Subject: ${subject}`);
    return true; // Simulate success
  }
  
  try {
    await transporter.sendMail({
      from: fromEmail,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
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
  const html = `<p>Please verify your email using this token: <strong>${token}</strong></p>`;
  return sendEmail(to, 'Email Verification', html);
};
