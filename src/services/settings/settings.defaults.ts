export const SETTINGS_DEFAULTS = {
  general: {
    platformName: "Go Experts",
    brandIcon: "G",
    tagline: "Working With You. For You.",
    supportEmail: "servicedesk@goexperts.in",
    timezone: "Asia/Kolkata (UTC+05:30)",
    defaultCurrency: "INR ₹",
    defaultLanguage: "English",
    description:
      "Go Experts connects freelancers, clients, investors and startup founders on a single trusted platform.",
    maintenanceMode: false,
  },
  branding: {
    primaryColor: "#E30613",
    sidebarColor: "#111111",
    lightLogoUrl: "https://goexperts.in/logo.png",
    darkLogoUrl: "https://goexperts.in/logo.png",
    faviconUrl: "https://goexperts.in/favicon.svg",
    sidebarIconUrl: "https://goexperts.in/favicon.svg",
    defaultFreelancerLogo: null,
    defaultFreelancerBanner: null,
    defaultInvestorLogo: null,
    defaultInvestorBanner: null,
    defaultStartupLogo: null,
    defaultStartupBanner: null,
    defaultClientLogo: null,
    defaultClientBanner: null,
  },
  industry_colors: {
    Founder: "#10b981",
    Freelancer: "#8b5cf6",
    Investor: "#3b82f6",
    Client: "#f59e0b",
  },
  recommendation_tabs: {
    freelancer: [
      {
        key: "projects",
        label: "Projects",
        title: "Projects",
        subtitle: "Matched Projects",
        description: "Browse roles that fit your profile, skills, and availability.",
        icon: "work_outline",
        accent: "#2563EB",
      },
      {
        key: "investors",
        label: "Investors",
        title: "Investors",
        subtitle: "Funding partners",
        description: "Relevant investors and commercial partners for strategic growth.",
        icon: "account_balance_outlined",
        accent: "#7C3AED",
      },
      {
        key: "startups",
        label: "Startups",
        title: "Startups",
        subtitle: "Early-stage teams",
        description: "Discover startups looking for execution support and long-term help.",
        icon: "rocket_launch_outlined",
        accent: "#7C3AED",
      },
    ],
    client: [
      {
        key: "freelancers",
        label: "Freelancers",
        title: "Freelancers",
        subtitle: "Top talent ready to hire",
        description: "Shortlisted freelancers with the right skills and availability.",
        icon: "person_search_outlined",
        accent: "#2563EB",
      },
      {
        key: "startups",
        label: "Startups",
        title: "Startups",
        subtitle: "High-potential companies",
        description: "See startups that match your investment thesis and stage focus.",
        icon: "rocket_launch_outlined",
        accent: "#2563EB",
      },
      {
        key: "investors",
        label: "Investors",
        title: "Investors",
        subtitle: "Funding partners",
        description: "Relevant investors and commercial partners for strategic growth.",
        icon: "account_balance_outlined",
        accent: "#7C3AED",
      },
    ],
    investor: [
      {
        key: "startups",
        label: "Startups",
        title: "Startups",
        subtitle: "High-potential companies",
        description: "See startups that match your investment thesis and stage focus.",
        icon: "rocket_launch_outlined",
        accent: "#2563EB",
      },
      {
        key: "projects",
        label: "Projects",
        title: "Projects",
        subtitle: "Matched  projects",
        description: "Browse roles that fit your profile, skills, and availability.",
        icon: "work_outline",
        accent: "#2563EB",
      },

      {
        key: "freelancers",
        label: "Freelancers",
        title: "Freelancers",
        subtitle: "Execution partners",
        description: "Find specialists who can support your portfolio companies.",
        icon: "engineering_outlined",
        accent: "#7C3AED",
      },
    ],
    founder: [
      {
        key: "investors",
        label: "Investors",
        title: "Investors",
        subtitle: "Active funding partners",
        description: "Track investors aligned with your stage, sector, and raise size.",
        icon: "account_balance_outlined",
        accent: "#2563EB",
      },
      {
        key: "freelancers",
        label: "Freelancers",
        title: "Freelancers",
        subtitle: "Execution support",
        description: "Find specialists to help with product, design, growth, and ops.",
        icon: "engineering_outlined",
        accent: "#0F766E",
      },
      {
        key: "projects",
        label: "Projects",
        title: "Projects",
        subtitle: "Matched Projects",
        description: "Browse roles that fit your profile, skills, and availability.",
        icon: "work_outline",
        accent: "#2563EB",
      },

    ],
  },
  email: {
    provider: "Custom SMTP",
    apiKey: "Goexperts@2025",
    host: "mail.goexperts.in",
    port: 465,
    username: "servicedesk@goexperts.in",
    fromEmail: "servicedesk@goexperts.in",
    fromName: "Go Experts Support",
    enabled: true,
  },
  sms: {
    provider: "Twilio",
    apiKey: "",
    senderId: "GOEXPERT",
    enabled: true,
  },
  whatsapp: {
    provider: "Meta Cloud API",
    apiKey: "",
    phoneNumberId: "",
    businessAccountId: "",
    enabled: true,
  },
  payments: {
    provider: "Stripe",
    apiKey: "",
    webhookSecret: "",
    currency: "INR",
    enabled: true,
  },
  apps: [
    { name: "Slack", description: "Real-time activity alerts in workspace channels.", connected: true, icon: "MessageSquare" },
    { name: "GitHub", description: "Automated repo commits and pull request sync.", connected: true, icon: "Cloud" },
    { name: "Google Analytics 4", description: "Traffic tracking and funnel conversion events.", connected: false, icon: "Activity" },
  ],
  security: {
    mfaRequired: true,
    sessionTimeoutMinutes: 60,
    maxLoginAttempts: 5,
    passwordMinLength: 8,
    ipAllowlist: "",
    auditRetentionDays: 90,
  },
  roles: [
    { name: "Super Admin", users: 2, perms: "Full access" },
    { name: "Admin", users: 8, perms: "All except billing & roles" },
    { name: "Content Manager", users: 6, perms: "CMS & content only" },
    { name: "Support Executive", users: 14, perms: "Tickets & chat" },
  ],
  apiKeys: [
    {
      name: "Production backend service",
      key: "ge_live_9a8b7c6d5e4f3a9b2c1d",
      created: "2026-01-12",
      status: "active",
      scope: "Full Access",
    },
    {
      name: "Staging sandbox Key",
      key: "ge_test_4b3c2d1e0f9a8b7c6d5e",
      created: "2026-02-04",
      status: "active",
      scope: "Read Only",
    },
  ],
  environment: {
    variables: [
      { key: "SUPABASE_URL", value: "https://nxkswlsqyzkpx.supabase.co", secret: false },
      { key: "SUPABASE_ANON_KEY", value: "eyJhY2Nlc3Nfa2V5IjoiMTI4NCJ9...", secret: true },
    ],
  },
  backups: [
    {
      id: "BKP-001",
      size: "24.5 MB",
      type: "Full Database Snapshot",
      created: "2026-07-01 02:00 AM",
      status: "Successful",
    },
    {
      id: "BKP-002",
      size: "23.9 MB",
      type: "Full Database Snapshot",
      created: "2026-07-02 02:00 AM",
      status: "Successful",
    },
  ],
  auditTrails: [
    {
      who: "Rohan Admin",
      action: "Updated SMTP server details",
      target: "Email Gateway",
      when: "2m ago",
    },
    {
      who: "Priya Kapoor",
      action: "Approved freelancer portfolio verification",
      target: "FRL-1024",
      when: "12m ago",
    },
    {
      who: "System cron",
      action: "Completed full nightly snapshot backup",
      target: "BKP-002",
      when: "1h ago",
    },
  ],
  systemLogs: [
    {
      id: "LOG-1",
      type: "auth",
      level: "info",
      text: "User rohan@goexperts.io successfully logged in.",
      time: "10 seconds ago",
      ip: "103.11.20.12",
    },
    {
      id: "LOG-2",
      type: "gateway",
      level: "warning",
      text: "Stripe callback took 450ms (higher than threshold).",
      time: "2 minutes ago",
      ip: "Stripe Server",
    },
    {
      id: "LOG-3",
      type: "cron",
      level: "info",
      text: "Nightly cron backup successfully mapped.",
      time: "4 hours ago",
      ip: "Cron Daemon",
    },
    {
      id: "LOG-4",
      type: "security",
      level: "danger",
      text: "Suspicious API access query from unverified IP.",
      time: "12 hours ago",
      ip: "89.24.120.4",
    },
  ],
  country: {
    defaultCountry: "India",
    defaultCountryCode: "IN",
    defaultPhoneCode: "+91",
    autoDetectUserLocation: true,
    phoneValidationEnabled: true,
    taxCalculationMode: "country_based",
    allowedCountries: ["India", "United States", "United Kingdom", "United Arab Emirates", "Canada", "Australia", "Germany", "Singapore"],
  },
  currency: {
    baseCurrency: "INR",
    defaultDisplayCurrency: "INR",
    autoExchangeRates: true,
    rateUpdateFrequency: "daily",
    thousandSeparator: ",",
    decimalSeparator: ".",
    symbolPosition: "prefix",
    allowedCurrencies: ["INR", "USD", "EUR", "GBP", "AED", "CAD", "AUD", "SGD", "SAR", "JPY"],
  },
  google_maps: {
    apiKey: "AIzaSyB_Sample_Google_Maps_Key_GoExperts",
    enablePlacesAutocomplete: true,
    enableGeocoding: true,
    defaultLatitude: 20.5937,
    defaultLongitude: 78.9629,
    defaultZoom: 5,
    countryRestriction: "IN",
    status: "active",
  },
  email_templates: [
    {
      id: "tpl_verification_link",
      name: "Verification Link Email",
      subject: "Verify Your GoExperts Account 📧",
      body: "Hello {{full_name}},\n\nPlease click the button below to verify your email address (Link & Code expire in 15 minutes):\n\n{{verification_link}}\n\nThank you,\nGoExperts Team",
      html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GoExperts</title>
  <style type="text/css">
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;display:block}
    body{margin:0!important;padding:0!important;width:100%!important;background-color:#eef2f7}
    @media only screen and (max-width:620px){.email-container{width:100%!important}.app-badge-td{display:block!important;text-align:center!important;padding:6px 0!important}}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:Inter,'Helvetica Neue',Arial,sans-serif;">
  <div style="display:none;font-size:1px;color:#eef2f7;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Verify your GoExperts account email to get started.&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="background-color:#eef2f7;">
    <tr><td style="padding:40px 16px;">
      <table role="presentation" class="email-container" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="max-width:600px;margin:auto;border-radius:14px;box-shadow:0 4px 24px rgba(15,23,42,0.10);">

        <!-- HEADER -->
        <tr>
          <td style="background:#ffffff;border-radius:14px 14px 0 0;padding:0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="padding:20px 32px;vertical-align:middle;">
                  <a href="https://goexperts.in" target="_blank" style="text-decoration:none;display:inline-block;">
                    <img src="https://goexperts.in/logo.png" alt="GoExperts" width="160" style="border:0;outline:none;text-decoration:none;display:block;max-width:160px;height:auto;" />
                  </a>
                </td>
                <td align="right" style="padding:20px 32px;vertical-align:middle;">
                  <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;font-family:Inter,Arial,sans-serif;">Email Verification</div>
                  <div style="color:#94a3b8;font-size:10px;font-family:Inter,Arial,sans-serif;margin-top:3px;">Working With You. For You.</div>
                </td>
              </tr>
              <tr><td colspan="2" style="padding:0;"><div style="height:3px;background:linear-gradient(90deg,#c0392b 0%,#e74c3c 50%,#1a2e5a 100%);"></div></td></tr>
            </table>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="background:#ffffff;padding:44px 40px 36px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
            <p style="margin:0 0 4px;color:#64748b;font-size:13px;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;font-family:Inter,Arial,sans-serif;">Email Verification</p>
            <h1 style="margin:0 0 8px;color:#0f172a;font-size:26px;font-weight:800;line-height:1.2;font-family:Inter,Arial,sans-serif;">Verify Your Email Address 📧</h1>
            <p style="margin:0 0 24px;color:#64748b;font-size:15px;font-family:Inter,Arial,sans-serif;">Thank you for registering with <strong>GoExperts</strong>. Please click the button below to verify your email address and retrieve your OTP verification code:</p>

            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:28px auto;">
              <tr>
                <td style="border-radius:8px;background-color:#c0392b;" align="center">
                  <a href="{{verification_link}}" target="_blank" style="background-color:#c0392b;color:#ffffff;font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:700;line-height:50px;text-align:center;text-decoration:none;display:inline-block;border-radius:8px;padding:0 32px;min-width:220px;">Verify Email &amp; View Code &rarr;</a>
                </td>
              </tr>
            </table>

            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fff7ed;border-left:4px solid #f97316;border-radius:0 8px 8px 0;margin:0 0 24px;">
              <tr><td style="padding:14px 18px;">
                <p style="margin:0 0 4px;color:#92400e;font-size:13px;font-weight:700;font-family:Inter,Arial,sans-serif;">⏰ Security Notice</p>
                <p style="margin:0;color:#78350f;font-size:13px;line-height:1.6;font-family:Inter,Arial,sans-serif;">This verification link and OTP code will expire in <strong>15 minutes</strong>. Do not share it with anyone.</p>
              </td></tr>
            </table>

            <p style="margin:0 0 8px;color:#64748b;font-size:13px;font-family:Inter,Arial,sans-serif;">Button not working? Copy and paste this link:</p>
            <p style="margin:0 0 24px;"><a href="{{verification_link}}" style="color:#c0392b;font-size:12px;word-break:break-all;text-decoration:none;font-family:Inter,Arial,sans-serif;">{{verification_link}}</a></p>
            <p style="margin:0;color:#374151;font-size:13px;font-weight:600;font-family:Inter,Arial,sans-serif;">The GoExperts Team</p>
          </td>
        </tr>

        <!-- FOOTER: Info Bar -->
        <tr>
          <td style="background:#0d766e;padding:18px 36px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:middle;"><a href="https://goexperts.in" style="color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;font-family:Inter,Arial,sans-serif;">🌐 www.goexperts.in</a></td>
                <td align="right" style="vertical-align:middle;"><a href="mailto:servicedesk@goexperts.in" style="color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;font-family:Inter,Arial,sans-serif;">📧 servicedesk@goexperts.in</a></td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FOOTER: App Download -->
        <tr>
          <td style="background:#f8fafc;padding:24px 36px;text-align:center;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
            <p style="margin:0 0 6px;color:#374151;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;font-family:Inter,Arial,sans-serif;">Download Our App</p>
            <p style="margin:0 0 16px;color:#94a3b8;font-size:12px;font-family:Inter,Arial,sans-serif;">Manage your account, projects &amp; connections on the go</p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
              <tr>
                <td class="app-badge-td" style="padding:0 8px 0 0;vertical-align:middle;">
                  <a href="https://play.google.com/store" target="_blank" style="text-decoration:none;display:inline-block;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                      <td style="background:#1a1a2e;border-radius:9px;border:1px solid #2d2d44;padding:9px 18px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                          <td style="padding-right:10px;vertical-align:middle;"><div style="width:0;height:0;border-top:12px solid transparent;border-bottom:12px solid transparent;border-left:20px solid #4ade80;"></div></td>
                          <td style="vertical-align:middle;">
                            <div style="color:#9ca3af;font-size:9px;letter-spacing:0.5px;text-transform:uppercase;font-family:Inter,Arial,sans-serif;">GET IT ON</div>
                            <div style="color:#ffffff;font-size:15px;font-weight:700;font-family:Inter,Arial,sans-serif;">Google Play</div>
                          </td>
                        </tr></table>
                      </td>
                    </tr></table>
                  </a>
                </td>
                <td class="app-badge-td" style="padding:0 0 0 8px;vertical-align:middle;">
                  <a href="https://apps.apple.com" target="_blank" style="text-decoration:none;display:inline-block;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                      <td style="background:#1a1a2e;border-radius:9px;border:1px solid #2d2d44;padding:9px 18px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                          <td style="padding-right:10px;vertical-align:middle;font-size:22px;color:#ffffff;font-family:Arial,sans-serif;">&#63743;</td>
                          <td style="vertical-align:middle;">
                            <div style="color:#9ca3af;font-size:9px;letter-spacing:0.5px;text-transform:uppercase;font-family:Inter,Arial,sans-serif;">Download on the</div>
                            <div style="color:#ffffff;font-size:15px;font-weight:700;font-family:Inter,Arial,sans-serif;">App Store</div>
                          </td>
                        </tr></table>
                      </td>
                    </tr></table>
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FOOTER: Social + Copyright -->
        <tr>
          <td style="background:#f1f5f9;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 14px 14px;padding:20px 36px 24px;text-align:center;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin-bottom:14px;">
              <tr>
                <td style="padding:0 6px;"><a href="https://linkedin.com/company/goexperts" target="_blank" style="text-decoration:none;"><div style="width:34px;height:34px;background:#0a66c2;border-radius:8px;text-align:center;line-height:34px;font-size:15px;color:#ffffff;font-weight:700;font-family:Arial,sans-serif;">in</div></a></td>
                <td style="padding:0 6px;"><a href="https://twitter.com/goexperts" target="_blank" style="text-decoration:none;"><div style="width:34px;height:34px;background:#000000;border-radius:8px;text-align:center;line-height:34px;font-size:16px;color:#ffffff;font-weight:900;font-family:Arial,sans-serif;">&#120143;</div></a></td>
                <td style="padding:0 6px;"><a href="https://instagram.com/goexperts" target="_blank" style="text-decoration:none;"><div style="width:34px;height:34px;background:linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);border-radius:8px;text-align:center;line-height:34px;font-size:18px;">📷</div></a></td>
              </tr>
            </table>
            <p style="margin:0 0 10px;color:#475569;font-size:13px;font-weight:600;font-family:Inter,Arial,sans-serif;">GoExperts &mdash; Connect. Build. Scale. Globally.</p>
            <p style="margin:0 0 6px;color:#94a3b8;font-size:11px;font-family:Inter,Arial,sans-serif;">
              <a href="https://goexperts.in/privacy" style="color:#94a3b8;text-decoration:none;">Privacy Policy</a> &bull;
              <a href="https://goexperts.in/terms" style="color:#94a3b8;text-decoration:none;">Terms of Service</a> &bull;
              <a href="https://goexperts.in/settings/notifications" style="color:#94a3b8;text-decoration:none;">Unsubscribe</a>
            </p>
            <p style="margin:0;color:#cbd5e1;font-size:11px;font-family:Inter,Arial,sans-serif;">&copy; 2025 GoExperts Private Limited. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
      isDefault: true,
    },
    {
      id: "tpl_welcome",
      name: "Welcome Email",
      subject: "Welcome to Go Experts! Your 90-Day Free Trial is Active 🎉",
      body: "Hello {{full_name}},\n\nWelcome to Go Experts! We are thrilled to have you onboard.\n\nBest regards,\nGo Experts Team",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; overflow: hidden;">
          <div style="padding: 24px; text-align: center; border-bottom: 3px solid #E30613;">
            <img src="https://goexperts.in/assets/img/logo.png" alt="Go Experts" style="max-height: 44px;" />
          </div>
          <div style="padding: 32px 24px;">
            <h2 style="color: #1a202c; font-size: 22px; font-weight: 800; margin-bottom: 12px;">Welcome to Go Experts! 🎉</h2>
            <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">Hello <strong>{{full_name}}</strong>, thank you for registering with <strong>Go Experts</strong> as a <strong>{{role}}</strong>.</p>
            
            <div style="background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 24px 0;">
              <h3 style="margin: 0 0 10px 0; color: #E30613; font-size: 16px; font-weight: 700;">🎁 90-Day Free Trial Activated!</h3>
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #4a5568;">Your account has been granted <strong>90 Days of Full Platform Access</strong> with zero commitment.</p>
              <p style="margin: 0; font-size: 13px; color: #718096;"><strong>Trial Expiry Date:</strong> {{trial_ends_at}}</p>
            </div>

            <div style="text-align: center; margin-top: 32px;">
              <a href="{{app_url}}" target="_blank" style="background-color: #E30613; color: #ffffff; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; text-decoration: none; display: inline-block;">Explore Platform Now &rarr;</a>
            </div>
          </div>
        </div>
      `,
      isDefault: true,
    }
  ],
} as const;

export type SettingsSection = keyof typeof SETTINGS_DEFAULTS;
