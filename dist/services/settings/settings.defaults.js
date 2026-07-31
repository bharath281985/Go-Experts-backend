export const SETTINGS_DEFAULTS = {
    general: {
        platformName: "Go Experts",
        brandIcon: "G",
        tagline: "Working With You. For You.",
        supportEmail: "support@goexperts.io",
        timezone: "Asia/Kolkata (UTC+05:30)",
        defaultCurrency: "INR ₹",
        defaultLanguage: "English",
        description: "Go Experts connects freelancers, clients, investors and startup founders on a single trusted platform.",
        maintenanceMode: false,
    },
    branding: {
        primaryColor: "#E30613",
        sidebarColor: "#111111",
    },
    email: {
        provider: "Custom SMTP",
        apiKey: "Goexperts@2025",
        host: "mail.goexperts.in",
        port: 465,
        username: "support@goexperts.in",
        fromEmail: "support@goexperts.in",
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
            subject: "Verify Your Go Experts Account",
            body: "Hello {{full_name}},\n\nPlease click the button below to verify your email address:\n\n{{verification_link}}\n\nVerification Code: {{otp_code}}\n\nThank you,\nGo Experts Team",
            html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #eaedf1;">
  <div style="padding: 24px; text-align: center; border-bottom: 3px solid #E30613;">
    <img src="https://goexperts.in/assets/img/logo.png" alt="Go Experts" style="max-height: 44px;" />
  </div>
  <div style="padding: 32px 24px;">
    <h2 style="color: #1a202c; font-size: 20px; font-weight: 700; margin-bottom: 12px;">Verify Your Email Address</h2>
    <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">Thank you for registering with <strong>Go Experts</strong>. Please click the button below to verify your email address and retrieve your verification code:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{verification_link}}" target="_blank" style="background-color: #E30613; color: #ffffff; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; text-decoration: none; display: inline-block;">Verify Email & View Code &rarr;</a>
    </div>
    <p style="font-size: 14px; color: #4a5568;">Your verification code is: <strong style="font-size: 18px; color: #E30613;">{{otp_code}}</strong></p>
  </div>
</div>`,
            isDefault: true,
        },
        {
            id: "tpl_welcome",
            name: "Welcome Email",
            subject: "Welcome to Go Experts!",
            body: "Hello {{full_name}},\n\nWelcome to Go Experts! We are thrilled to have you onboard.\n\nBest regards,\nGo Experts Team",
            html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Go Experts!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f6f8; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05); border: 1px solid #eaedf1;">
          <tr>
            <td style="background-color: #ffffff; padding: 28px 32px; text-align: center; border-bottom: 3px solid #E30613;">
              <img src="https://goexperts.in/assets/img/logo.png" alt="Go Experts" style="max-height: 44px; width: auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 32px 20px 32px; text-align: center;">
              <h2 style="color: #1a202c; font-size: 24px; font-weight: 800; margin: 0 0 12px 0;">Welcome to Go Experts! 🎉</h2>
              <p style="font-size: 15px; color: #4a5568; line-height: 1.6; margin: 0;">
                Hello <strong>{{full_name}}</strong>, we are thrilled to welcome you to the Go Experts platform. Connect with top freelancers, verified clients, investors, and innovative startups all in one place.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
                <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #2d3748;">What you can do on Go Experts:</p>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #4a5568; line-height: 1.8;">
                  <li>Post & Hire Top Talent across 50+ categories</li>
                  <li>Discover & Pitch Startup Ideas to Verified Investors</li>
                  <li>Bank-grade Escrow Payment Protection & Contracts</li>
                </ul>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 32px 30px 32px; text-align: center;">
              <a href="{{app_url}}" target="_blank" style="background-color: #E30613; color: #ffffff; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; text-decoration: none; display: inline-block;">
                Explore Go Experts Platform &rarr;
              </a>
            </td>
          </tr>
          <tr>
            <td style="background-color: #fafbfc; padding: 24px 32px; text-align: center; font-size: 12px; color: #718096; border-top: 1px solid #edf2f7;">
              <p style="margin: 0 0 6px 0; font-weight: 600; color: #4a5568;">Go Experts &bull; Working With You. For You.</p>
              <p style="margin: 0;">Need support? Contact us anytime at <a href="mailto:support@goexperts.in" style="color: #E30613; text-decoration: none;">support@goexperts.in</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
            isDefault: false,
        }
    ],
};
