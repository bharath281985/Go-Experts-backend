
import nodemailer from 'nodemailer';

const host = process.env.SMTP_HOST || 'mail.goexperts.in';
const port = parseInt(process.env.SMTP_PORT || '465');
const user = process.env.SMTP_USER || 'support@goexperts.in';
const pass = process.env.SMTP_PASS || 'Goexperts@2025';
const fromEmail = process.env.SMTP_FROM || 'support@goexperts.in';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://goexperts.in';

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
  tls: { rejectUnauthorized: false },
});

// ─── Core send utility ─────────────────────────────────────────────────────────
export const sendEmail = async (to: string, subject: string, html: string): Promise<boolean> => {
  try {
    const info = await transporter.sendMail({
      from: `"Go Experts" <${fromEmail}>`,
      to,
      subject,
      html,
    });
    console.log(`[EMAIL SENT] To: ${to} | Subject: "${subject}" | ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL FAILED] To: ${to} | Error:`, error);
    return false;
  }
};

// ─── Base email shell (table-based, works in Outlook/Gmail/Apple Mail) ──────────
const shell = (preheader: string, body: string) => `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Go Experts</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style type="text/css">
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    body { margin:0 !important; padding:0 !important; width:100% !important; }
    a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; }
    @media only screen and (max-width:620px) {
      .email-container { width:100% !important; }
      .fluid { max-width:100% !important; height:auto !important; }
      .stack-column, .stack-column-center { display:block !important; width:100% !important; max-width:100% !important; direction:ltr !important; }
      .stack-column-center { text-align:center !important; }
      .center-on-narrow { text-align:center !important; display:block !important; margin-left:auto !important; margin-right:auto !important; }
      td.center-on-narrow { display:block !important; }
      .padding-on-narrow { padding:20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Inter,'Helvetica Neue',Arial,sans-serif;">

  <!-- Preheader (hidden preview text) -->
  <div style="display:none;font-size:1px;color:#f0f4f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

  <!-- Email wrapper -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="background-color:#f0f4f8;">
    <tr>
      <td style="padding:32px 16px;">

        <!-- Email container -->
        <table role="presentation" class="email-container" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="max-width:600px;margin:auto;">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f2d5e 100%);border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                <tr>
                  <td>
                    <span style="font-size:28px;font-weight:800;letter-spacing:-0.5px;">
                      <span style="color:#f97316;">Go</span><span style="color:#ffffff;">Experts</span>
                    </span>
                    <p style="margin:6px 0 0;color:#94a3b8;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:500;">Global Talent Platform</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              ${body}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 8px;color:#64748b;font-size:12px;line-height:1.6;">
                You received this email because you have an account on Go Experts.<br/>
                <a href="${FRONTEND_URL}/settings/notifications" style="color:#f97316;text-decoration:none;">Manage email preferences</a>
              </p>
              <p style="margin:0;color:#94a3b8;font-size:11px;">
                © ${new Date().getFullYear()} Go Experts · 
                <a href="${FRONTEND_URL}/privacy" style="color:#94a3b8;text-decoration:none;">Privacy Policy</a> · 
                <a href="${FRONTEND_URL}/terms" style="color:#94a3b8;text-decoration:none;">Terms of Service</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ─── Reusable components ────────────────────────────────────────────────────────
const divider = () => `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:24px 0;"><tr><td style="border-top:1px solid #e2e8f0;"></td></tr></table>`;

const ctaButton = (url: string, label: string, bgColor = '#f97316') => `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:28px auto;">
  <tr>
    <td style="border-radius:8px;background-color:${bgColor};" align="center">
      <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:50px;v-text-anchor:middle;width:240px;" arcsize="16%" stroke="f" fillcolor="${bgColor}"><w:anchorlock/><center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:700;">${label}</center></v:roundrect><![endif]-->
      <!--[if !mso]><!--><a href="${url}" target="_blank" style="background-color:${bgColor};color:#ffffff;font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:700;line-height:50px;text-align:center;text-decoration:none;display:inline-block;border-radius:8px;padding:0 32px;min-width:200px;">
        ${label}
      </a><!--<![endif]-->
    </td>
  </tr>
</table>
`;

const badge = (text: string, bgColor: string, textColor: string) => `
  <span style="display:inline-block;background-color:${bgColor};color:${textColor};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:4px 12px;border-radius:20px;">${text}</span>
`;

const alertBox = (icon: string, title: string, body: string, bg: string, border: string, titleColor: string, bodyColor: string) => `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:24px 0;">
  <tr>
    <td style="background-color:${bg};border-left:4px solid ${border};border-radius:0 8px 8px 0;padding:16px 20px;">
      <p style="margin:0 0 4px;color:${titleColor};font-size:14px;font-weight:700;">${icon} ${title}</p>
      <p style="margin:0;color:${bodyColor};font-size:13px;line-height:1.6;">${body}</p>
    </td>
  </tr>
</table>
`;

const featureList = (items: { icon: string; text: string }[], color: string) => `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
  ${items.map(item => `
  <tr>
    <td style="padding:6px 0;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="width:32px;padding-right:12px;vertical-align:top;">
            <div style="width:28px;height:28px;background-color:${color}15;border-radius:6px;text-align:center;line-height:28px;font-size:14px;">${item.icon}</div>
          </td>
          <td style="vertical-align:middle;">
            <p style="margin:0;color:#374151;font-size:14px;line-height:1.5;">${item.text}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`).join('')}
</table>
`;

// ════════════════════════════════════════════════════════════════════════════════
// EMAIL 1: Account Active  (sent immediately after admin approves)
// ════════════════════════════════════════════════════════════════════════════════
export const sendAccountActiveEmail = (to: string, name: string) => {
  const firstName = (name || 'User').split(' ')[0];

  const body = `
    <p style="margin:0 0 4px;color:#64748b;font-size:13px;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;">Account Status Update</p>
    <h1 style="margin:0 0 8px;color:#0f172a;font-size:26px;font-weight:800;line-height:1.2;">Your account is now active! 🎉</h1>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">Hi <strong>${firstName}</strong>,</p>

    ${alertBox('✅', 'KYC Verification Approved', 'Your identity has been verified by our admin team. Your Go Experts account is now fully active and ready to use.', '#f0fdf4', '#22c55e', '#15803d', '#166534')}

    <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.7;">
      Welcome to Go Experts — a premium platform that connects top global talent with clients, investors, and founders across every industry.
    </p>

    ${featureList([
      { icon: '🔐', text: 'Your account is secured and verified' },
      { icon: '🌐', text: 'Access the full platform and connect globally' },
      { icon: '📋', text: 'Your profile is now visible to potential collaborators' },
    ], '#22c55e')}

    ${divider()}

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f8fafc;border-radius:8px;padding:1px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 4px;color:#374151;font-size:13px;font-weight:700;">📨 What happens next?</p>
        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.7;">
          Check your inbox for a second email from us — it contains a button to <strong>activate your Free 90-Day Plan</strong>. Click it to unlock full platform access.
        </p>
      </td></tr>
    </table>

    <p style="margin:32px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">
      If you have any questions, reply to this email or contact us at 
      <a href="mailto:support@goexperts.in" style="color:#f97316;text-decoration:none;">support@goexperts.in</a>
    </p>
    <p style="margin:8px 0 0;color:#374151;font-size:13px;font-weight:600;">The Go Experts Team</p>
  `;

  return sendEmail(to, '✅ Your Go Experts Account is Now Active', shell(
    `Great news, ${firstName}! Your KYC has been approved and your account is now active.`,
    body
  ));
};

// ════════════════════════════════════════════════════════════════════════════════
// EMAIL 2: Activate Free Plan  (sent at same time as Email 1)
// ════════════════════════════════════════════════════════════════════════════════
export const sendPlanActivationEmail = (to: string, name: string) => {
  const firstName = (name || 'User').split(' ')[0];
  const activationLink = `${FRONTEND_URL}/verify-plan?email=${encodeURIComponent(to)}`;

  const body = `
    <p style="margin:0 0 4px;color:#64748b;font-size:13px;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;">Action Required</p>
    <h1 style="margin:0 0 8px;color:#0f172a;font-size:26px;font-weight:800;line-height:1.2;">Activate your Free Plan 🚀</h1>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">Hi <strong>${firstName}</strong>,</p>

    <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.7;">
      Congratulations on getting approved! You're eligible for a <strong>Free 90-Day Access Plan</strong>. Click the button below, verify your email with a quick OTP, and your plan activates instantly.
    </p>

    <!-- Plan Card -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border:1px solid #e0f2fe;background:linear-gradient(135deg,#eff6ff 0%,#f0f9ff 100%);border-radius:12px;margin-bottom:24px;">
      <tr>
        <td style="padding:24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td>
                <p style="margin:0 0 4px;color:#0369a1;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Free Starter Plan</p>
                <p style="margin:0 0 16px;color:#0f172a;font-size:22px;font-weight:800;">90 Days Free Access <span style="font-size:14px;color:#64748b;font-weight:400;">— No credit card required</span></p>
                ${featureList([
                  { icon: '💼', text: 'Post and browse unlimited projects & proposals' },
                  { icon: '🤝', text: 'Connect with verified clients, freelancers & investors' },
                  { icon: '🔒', text: 'Secure milestone-based payment escrow system' },
                  { icon: '📊', text: 'Access industry analytics and market insights' },
                ], '#3b82f6')}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${ctaButton(activationLink, '🔓 Activate My Free Plan', '#f97316')}

    <p style="margin:0 0 4px;text-align:center;color:#94a3b8;font-size:12px;">Button not working? Copy and paste this link:</p>
    <p style="margin:0;text-align:center;"><a href="${activationLink}" style="color:#3b82f6;font-size:12px;word-break:break-all;text-decoration:none;">${activationLink}</a></p>

    ${divider()}

    ${alertBox('⏰', 'This link is for your account only', 'For your security, the plan activation OTP will be sent to this email address. Do not share your OTP with anyone.', '#fefce8', '#f59e0b', '#92400e', '#78350f')}

    <p style="margin:0;color:#374151;font-size:13px;font-weight:600;">The Go Experts Team</p>
  `;

  return sendEmail(to, '🚀 Activate Your Free 90-Day Plan on Go Experts', shell(
    `Your Free 90-Day Plan is ready, ${firstName}! Click to activate now — takes less than 1 minute.`,
    body
  ));
};

// ════════════════════════════════════════════════════════════════════════════════
// EMAIL 3: OTP Code  (sent when user clicks "Activate" button)
// ════════════════════════════════════════════════════════════════════════════════
export const sendPlanActivationOtpEmail = (to: string, token: string) => {
  console.log(`\n======================================================================`);
  console.log(`🔑 [PLAN ACTIVATION OTP DISPATCH]`);
  console.log(`   Recipient: ${to}`);
  console.log(`   OTP Code:  ${token}`);
  console.log(`======================================================================\n`);

  const body = `
    <p style="margin:0 0 4px;color:#64748b;font-size:13px;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;">Verification Code</p>
    <h1 style="margin:0 0 8px;color:#0f172a;font-size:26px;font-weight:800;line-height:1.2;">Your OTP is here 🔐</h1>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">Use the code below to verify your email and activate your Go Experts free plan.</p>

    <!-- OTP Box -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="margin:0 0 24px;">
      <tr>
        <td align="center" style="background:#0f172a;border-radius:12px;padding:32px 24px;">
          <p style="margin:0 0 12px;color:#94a3b8;font-size:12px;font-weight:600;letter-spacing:3px;text-transform:uppercase;">One-Time Password</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
            <tr>
              ${token.split('').map(digit => `
              <td style="padding:0 4px;">
                <div style="width:44px;height:56px;background:#1e293b;border:2px solid #f97316;border-radius:8px;text-align:center;line-height:56px;color:#f97316;font-size:28px;font-weight:800;font-family:monospace;">${digit}</div>
              </td>`).join('')}
            </tr>
          </table>
          <p style="margin:16px 0 0;color:#475569;font-size:12px;">
            ⏱ Expires in <strong style="color:#f59e0b;">10 minutes</strong>
          </p>
        </td>
      </tr>
    </table>

    <!-- Steps -->
    <p style="margin:0 0 12px;color:#374151;font-size:14px;font-weight:700;">How to use this code:</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
      ${[
        ['1', '#f97316', 'Go back to the verification page in your browser'],
        ['2', '#3b82f6', 'Enter the 6-digit code shown above'],
        ['3', '#22c55e', 'Click Verify — your plan activates instantly!'],
      ].map(([num, color, text]) => `
      <tr>
        <td style="padding:6px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="width:32px;vertical-align:top;padding-right:12px;">
                <div style="width:26px;height:26px;background-color:${color};border-radius:50%;text-align:center;line-height:26px;color:#fff;font-size:12px;font-weight:800;">${num}</div>
              </td>
              <td style="vertical-align:middle;">
                <p style="margin:0;color:#374151;font-size:14px;">${text}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`).join('')}
    </table>

    ${alertBox('🚫', 'Never share this code', "Go Experts will NEVER ask for your OTP via phone, chat, or any other method. If someone asks for it, it's a scam.", '#fef2f2', '#ef4444', '#991b1b', '#7f1d1d')}

    <p style="margin:0;color:#374151;font-size:13px;font-weight:600;">The Go Experts Team</p>
  `;

  return sendEmail(to, '🔐 Your Plan Activation Code — Go Experts', shell(
    `Your OTP is ${token}. Use it to activate your Go Experts free plan. Expires in 10 minutes.`,
    body
  ));
};

// ════════════════════════════════════════════════════════════════════════════════
// EMAIL 4: Dynamic Industry Welcome  (sent after OTP verified & plan activated)
// ════════════════════════════════════════════════════════════════════════════════
export const sendDynamicIndustryEmail = (to: string, name: string, role: string) => {
  const firstName = (name || 'User').split(' ')[0];

  type Config = {
    badge: string; badgeBg: string; badgeText: string;
    headline: string; subheadline: string; intro: string;
    features: { icon: string; title: string; desc: string }[];
    cta1Label: string; cta1Url: string; cta1Color: string;
    cta2Label: string; cta2Url: string;
    accentColor: string;
    tips: string[];
  };

  const configs: Record<string, Config> = {
    freelancer: {
      badge: 'Freelancer', badgeBg: '#eff6ff', badgeText: '#1d4ed8',
      headline: 'Start winning projects today',
      subheadline: 'Top clients are actively looking for your skills right now.',
      intro: `Your profile is live and visible to hundreds of verified clients across every industry. Here's how to make the most of your first 90 days:`,
      features: [
        { icon: '🔍', title: 'Browse & Bid on Projects', desc: 'Explore active projects filtered by your skills, budget, and industry category.' },
        { icon: '💬', title: 'Submit Winning Proposals', desc: 'Use our AI-powered proposal tips to stand out from other freelancers.' },
        { icon: '🔒', title: 'Get Paid Securely', desc: 'Milestone-based escrow ensures you are always paid for your work on time.' },
      ],
      cta1Label: '🔍 Browse Open Projects', cta1Url: `${FRONTEND_URL}/projects`, cta1Color: '#3b82f6',
      cta2Label: 'Complete your profile →', cta2Url: `${FRONTEND_URL}/dashboard/profile`,
      accentColor: '#3b82f6',
      tips: ['Add a portfolio to boost your profile visibility by 3x', 'Complete your skills section to get matched to relevant projects', 'Set your availability so clients know when you\'re ready to start'],
    },
    client: {
      badge: 'Client', badgeBg: '#fdf4ff', badgeText: '#7e22ce',
      headline: 'Find the perfect freelancer',
      subheadline: 'Your project deserves the best talent. We have thousands of verified professionals.',
      intro: `Your account is active and ready. Post your first project in under 5 minutes and start receiving proposals from verified freelancers.`,
      features: [
        { icon: '📝', title: 'Post a Project for Free', desc: 'Describe your project, set your budget, and receive proposals within hours.' },
        { icon: '👥', title: 'Browse Top Talent', desc: 'Filter freelancers by skills, experience, ratings, and industry expertise.' },
        { icon: '🛡️', title: 'Hire with Confidence', desc: 'Milestone-based payments protect both you and your freelancer.' },
      ],
      cta1Label: '📝 Post a Project Now', cta1Url: `${FRONTEND_URL}/post-project`, cta1Color: '#8b5cf6',
      cta2Label: 'Browse freelancers →', cta2Url: `${FRONTEND_URL}/freelancers`,
      accentColor: '#8b5cf6',
      tips: ['Clear project descriptions get 60% more quality proposals', 'Set a realistic budget to attract experienced freelancers', 'Use milestone payments to manage project risk effectively'],
    },
    investor: {
      badge: 'Investor', badgeBg: '#f0fdf4', badgeText: '#15803d',
      headline: 'Discover your next investment',
      subheadline: 'Curated startup opportunities across high-growth industries — verified and ready.',
      intro: `Your investor profile is now active. Start exploring startups across your preferred sectors, connect with founders, and track the opportunities that match your thesis.`,
      features: [
        { icon: '🚀', title: 'Browse Verified Startups', desc: 'Explore startups filtered by industry, stage, traction, and funding ask.' },
        { icon: '📊', title: 'Track & Analyze', desc: 'View detailed financials, team backgrounds, and market analysis for each startup.' },
        { icon: '🤝', title: 'Connect with Founders', desc: 'Initiate direct conversations with vetted founders looking for strategic investors.' },
      ],
      cta1Label: '🚀 Explore Startups', cta1Url: `${FRONTEND_URL}/startups`, cta1Color: '#10b981',
      cta2Label: 'Set investment preferences →', cta2Url: `${FRONTEND_URL}/dashboard/preferences`,
      accentColor: '#10b981',
      tips: ['Set industry filters to get personalized startup recommendations', 'Complete your investor profile to attract inbound from top founders', 'Follow startups you\'re interested in to track their progress'],
    },
    founder: {
      badge: 'Founder', badgeBg: '#fff7ed', badgeText: '#c2410c',
      headline: 'Build, raise, and scale',
      subheadline: 'Connect with investors who believe in your vision and hire the talent to bring it to life.',
      intro: `Your founder profile is live. Investors are actively browsing for startups like yours. Here is how to maximize your visibility and traction on the platform:`,
      features: [
        { icon: '💡', title: 'Get Discovered by Investors', desc: 'Your startup profile is visible to hundreds of active investors on the platform.' },
        { icon: '👩‍💻', title: 'Hire Top Freelancers', desc: 'Build your product faster with verified freelance developers, designers, and marketers.' },
        { icon: '📈', title: 'Track Investor Engagement', desc: 'See which investors have viewed your profile and expressed interest.' },
      ],
      cta1Label: '💡 View Investor Matches', cta1Url: `${FRONTEND_URL}/investors`, cta1Color: '#f59e0b',
      cta2Label: 'Complete your startup profile →', cta2Url: `${FRONTEND_URL}/dashboard/startup`,
      accentColor: '#f59e0b',
      tips: ['Add a pitch deck to your profile to increase investor interest by 4x', 'List your traction metrics — investors want to see growth', 'Define your funding ask clearly to attract the right investors'],
    },
  };

  const cfg: Config = configs[role?.toLowerCase()] || configs['freelancer'];

  const featuresHtml = cfg.features.map(f => `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:16px;">
      <tr>
        <td style="width:48px;vertical-align:top;padding-right:16px;">
          <div style="width:40px;height:40px;background:${cfg.accentColor}15;border-radius:10px;text-align:center;line-height:40px;font-size:20px;">${f.icon}</div>
        </td>
        <td style="vertical-align:top;">
          <p style="margin:0 0 4px;color:#0f172a;font-size:14px;font-weight:700;">${f.title}</p>
          <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">${f.desc}</p>
        </td>
      </tr>
    </table>
  `).join('');

  const tipsHtml = cfg.tips.map(t => `
    <tr><td style="padding:4px 0;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
        <td style="width:20px;vertical-align:top;color:${cfg.accentColor};font-size:14px;padding-right:8px;">→</td>
        <td><p style="margin:0;color:#374151;font-size:13px;line-height:1.5;">${t}</p></td>
      </tr></table>
    </td></tr>
  `).join('');

  const body = `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:8px;">
      <tr>
        <td>${badge(cfg.badge, cfg.badgeBg, cfg.badgeText)}</td>
      </tr>
    </table>
    <h1 style="margin:12px 0 4px;color:#0f172a;font-size:26px;font-weight:800;line-height:1.2;">${cfg.headline} 🎯</h1>
    <p style="margin:0 0 8px;color:#64748b;font-size:15px;font-weight:500;">${cfg.subheadline}</p>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;">Hi <strong>${firstName}</strong>,</p>

    <!-- Green success bar -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:14px 20px;">
        <p style="margin:0;color:#15803d;font-size:14px;font-weight:700;">🎉 Your free plan is active — 90 days remaining</p>
        <p style="margin:4px 0 0;color:#166534;font-size:13px;">You have full access to everything Go Experts has to offer.</p>
      </td></tr>
    </table>

    <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.7;">${cfg.intro}</p>

    ${featuresHtml}

    ${ctaButton(cfg.cta1Url, cfg.cta1Label, cfg.cta1Color)}

    <p style="text-align:center;margin:-12px 0 24px;">
      <a href="${cfg.cta2Url}" style="color:${cfg.accentColor};font-size:13px;text-decoration:none;font-weight:600;">${cfg.cta2Label}</a>
    </p>

    ${divider()}

    <!-- Pro Tips -->
    <p style="margin:0 0 12px;color:#0f172a;font-size:14px;font-weight:700;">💡 Pro tips for your first week:</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
      ${tipsHtml}
    </table>

    ${divider()}

    <p style="margin:0 0 4px;color:#374151;font-size:13px;font-weight:600;">Questions? We're here for you.</p>
    <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
      Reply to this email or reach us at <a href="mailto:support@goexperts.in" style="color:#f97316;text-decoration:none;">support@goexperts.in</a>. Our team typically responds within 24 hours.
    </p>
    <p style="margin:16px 0 0;color:#374151;font-size:13px;font-weight:600;">The Go Experts Team</p>
  `;

  return sendEmail(
    to,
    `🎯 Welcome aboard, ${firstName}! Here's how to get started`,
    shell(`Your Go Experts free plan is active! Here's everything you need to hit the ground running.`, body)
  );
};

// ─── Existing utility emails (unchanged) ────────────────────────────────────────
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
  const firstName = (name || 'User').split(' ')[0];
  const body = `
    <h1 style="margin:0 0 8px;color:#0f172a;font-size:24px;font-weight:800;">Account Deleted</h1>
    <p style="margin:0 0 20px;color:#64748b;font-size:14px;">Hi <strong>${firstName}</strong>,</p>
    <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">
      This is to confirm that your Go Experts account and all associated data have been permanently deleted as requested.
    </p>
    <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 24px;">
      If this was a mistake or you did not request this, please contact our support team immediately at 
      <a href="mailto:support@goexperts.in" style="color:#f97316;text-decoration:none;">support@goexperts.in</a>.
    </p>
    <p style="margin:0;color:#374151;font-size:13px;font-weight:600;">The Go Experts Team</p>
  `;
  return sendEmail(to, 'Your Go Experts Account Has Been Deleted', shell('Your account has been permanently deleted.', body));
};
