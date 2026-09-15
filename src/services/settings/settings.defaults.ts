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
    welcomeBonusEnabled: true,
    welcomeBonusAmount: 99,
    referralCashbackPercent: 5,
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
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; overflow: hidden;">
          <div style="padding: 24px; text-align: center; border-bottom: 3px solid #E30613;">
            <img src="https://goexperts.in/assets/img/logo.png" alt="Go Experts" style="max-height: 44px;" />
          </div>
          <div style="padding: 32px 24px;">
            <h2 style="color: #1a202c; font-size: 22px; font-weight: 800; margin-bottom: 12px;">Verify Your Email Address 📧</h2>
            <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">Thank you for registering with <strong>Go Experts</strong>. Please click the button below to verify your email address and retrieve your OTP verification code:</p>
            
            <div style="text-align: center; margin-top: 32px; margin-bottom: 32px;">
              <a href="{{verification_link}}" target="_blank" style="background-color: #E30613; color: #ffffff; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; text-decoration: none; display: inline-block;">Verify Email &amp; View Code &rarr;</a>
            </div>

            <div style="background-color: #fff7ed; border-left: 4px solid #f97316; border-radius: 4px 8px 8px 4px; padding: 16px; margin: 24px 0;">
              <h3 style="margin: 0 0 8px 0; color: #92400e; font-size: 14px; font-weight: 700;">⏰ Security Notice</h3>
              <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 1.5;">This verification link and OTP code will expire in <strong>15 minutes</strong>. Do not share it with anyone.</p>
            </div>
            
            <p style="font-size: 13px; color: #718096; margin-top: 24px;">Button not working? Copy and paste this link:<br/><a href="{{verification_link}}" style="color: #E30613;">{{verification_link}}</a></p>
          </div>
        </div>
      `,
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
    },
    {
      id: "tpl_referral_cashback",
      name: "Referral Cashback Received",
      subject: "You've earned ₹{{cashback_amount}} cashback! 💰",
      body: "Hello {{full_name}},\n\nGreat news! Your friend {{friend_name}} just purchased a subscription plan. As a thank you for referring them, we've credited ₹{{cashback_amount}} (5% of the plan value) to your wallet.\n\nYour new wallet balance is ₹{{total_balance}}.\n\nBest regards,\nGo Experts Team",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; overflow: hidden;">
          <div style="padding: 24px; text-align: center; border-bottom: 3px solid #E30613;">
            <img src="https://goexperts.in/assets/img/logo.png" alt="Go Experts" style="max-height: 44px;" />
          </div>
          <div style="padding: 32px 24px;">
            <h2 style="color: #1a202c; font-size: 22px; font-weight: 800; margin-bottom: 12px;">You earned cashback! 💰</h2>
            <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">Hello <strong>{{full_name}}</strong>,</p>
            <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">Great news! Your friend <strong>{{friend_name}}</strong> just purchased a subscription plan on Go Experts.</p>
            
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 20px; margin: 24px 0;">
              <h3 style="margin: 0 0 10px 0; color: #166534; font-size: 16px; font-weight: 700;">₹{{cashback_amount}} Credited</h3>
              <p style="margin: 0; font-size: 14px; color: #15803d;">We've added 5% of their plan value to your wallet as a thank you for referring them.</p>
            </div>

            <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">Your updated wallet balance is now <strong>₹{{total_balance}}</strong>.</p>
            
            <div style="text-align: center; margin-top: 32px;">
              <a href="{{app_url}}" target="_blank" style="background-color: #E30613; color: #ffffff; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; text-decoration: none; display: inline-block;">View Wallet &rarr;</a>
            </div>
          </div>
        </div>
      `,
      isDefault: true,
    }
  ],
  splash: {
    enabled: true,
    splash: {
      imageUrl: "",
      imageName: "",
      videoUrl: "",
      videoName: "",
    },
    onboarding: {
      steps: [
        {
          title: "Discover Go Experts",
          description: "Find verified freelancers, investors, clients, and founders in one place.",
          mediaUrl: "",
          mediaName: "",
          mediaType: "image",
        },
        {
          title: "Connect With the Right People",
          description: "Use smart matching to build your network and start meaningful conversations.",
          mediaUrl: "",
          mediaName: "",
          mediaType: "image",
        },
        {
          title: "Build, Fund, and Scale",
          description: "Manage opportunities, projects, funding, and growth from your workspace.",
          mediaUrl: "",
          mediaName: "",
          mediaType: "image",
        },
      ],
    },
    logo: {
      logoUrl: "",
      logoName: "",
    },
  },
} as const;

export type SettingsSection = keyof typeof SETTINGS_DEFAULTS;
