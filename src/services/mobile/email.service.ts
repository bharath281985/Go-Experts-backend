
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

export const sendAccountDeletedEmail = (to: string, name: string) => {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
      <h2 style="color: #333;">Account Deletion Notice</h2>
      <p>Hello ${name || 'User'},</p>
      <p>This is to confirm that your account on Go Experts has been successfully deleted. We are sorry to see you go!</p>
      <p>If this was a mistake, or if you would like to restore your account, please contact our support team immediately.</p>
      <br />
      <p>Best regards,<br/><strong>The Go Experts Team</strong></p>
    </div>
  `;
  return sendEmail(to, 'Your Go Experts account has been deleted', html);
};

export const sendKycApprovalPlanActivationEmail = (to: string, name: string) => {
  const frontendUrl = process.env.FRONTEND_URL || 'https://goexperts.in';
  const activationLink = `${frontendUrl}/activate-plan?email=${encodeURIComponent(to)}`;
  
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
      <h2 style="color: #333;">Your Account is Activated!</h2>
      <p>Hello ${name || 'User'},</p>
      <p>Great news! Your KYC has been approved and your Go Experts account is now officially activated.</p>
      <p>To start using your account, you need to activate your Free Plan. Please click the button below to complete the activation process:</p>
      <br />
      <a href="${activationLink}" style="background-color: #007bff; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Activate Free Plan</a>
      <br /><br />
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p><a href="${activationLink}">${activationLink}</a></p>
      <br />
      <p>Best regards,<br/><strong>The Go Experts Team</strong></p>
    </div>
  `;
  return sendEmail(to, 'Account Activated - Activate Your Free Plan', html);
};

export const sendPlanActivationOtpEmail = (to: string, token: string) => {
  console.log(`\n======================================================================`);
  console.log(`🔑 [PLAN ACTIVATION OTP DISPATCH]`);
  console.log(`   Recipient: ${to}`);
  console.log(`   OTP Code:  ${token}`);
  console.log(`======================================================================\n`);
  
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
      <h2 style="color: #333;">Plan Activation OTP</h2>
      <p>You are one step away from activating your free plan on Go Experts.</p>
      <p>Please use the following One-Time Password (OTP) to verify your email and activate your plan:</p>
      <div style="font-size: 24px; font-weight: bold; padding: 15px; background-color: #f5f5f5; text-align: center; margin: 20px 0; border-radius: 5px;">
        ${token}
      </div>
      <p>If you did not request this, please ignore this email.</p>
      <br />
      <p>Best regards,<br/><strong>The Go Experts Team</strong></p>
    </div>
  `;
  return sendEmail(to, 'Your Plan Activation OTP', html);
};
