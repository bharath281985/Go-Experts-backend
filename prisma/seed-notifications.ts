/**
 * Notification Seed – Phase 3
 * Seeds: NotificationTemplates, NotificationPreferences, sample Notifications, NotificationCampaigns
 * Safe to run on an already-populated database. Uses correct Prisma schema field names.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function addDays(d: Date, days: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return nd;
}

async function main() {
  console.log("🔔 Seeding Notification Engine...\n");

  // ─────────────────────────────────────────
  // 1. NOTIFICATION TEMPLATES
  // ─────────────────────────────────────────
  console.log("Creating notification templates...");
  const templateDefs = [
    // Subscription
    {
      name: "Subscription Activated", code: "SUBSCRIPTION_ACTIVATED",
      category: "subscription", channel: "email",
      subject: "Your {{plan}} subscription is now active!",
      body: "Hi {{name}},\n\nYour subscription to **{{plan}}** has been activated successfully.\n\nStart date: {{startDate}}\nExpiry: {{endDate}}\n\nEnjoy your access!\n\nTeam Go Experts",
      variables: ["name", "plan", "startDate", "endDate"],
    },
    {
      name: "Subscription Expiry Warning", code: "SUBSCRIPTION_EXPIRY_WARNING",
      category: "subscription", channel: "email",
      subject: "Your subscription expires in {{days}} days",
      body: "Hi {{name}},\n\nThis is a reminder that your **{{plan}}** subscription will expire in {{days}} days on {{endDate}}.\n\nRenew now to avoid interruption.",
      variables: ["name", "plan", "days", "endDate"],
    },
    {
      name: "Subscription Expired", code: "SUBSCRIPTION_EXPIRED",
      category: "subscription", channel: "in_app",
      subject: "Subscription expired",
      body: "Your {{plan}} subscription has expired. Renew now to continue accessing premium features.",
      variables: ["plan"],
    },
    {
      name: "Subscription Renewal Success", code: "SUBSCRIPTION_RENEWAL_SUCCESS",
      category: "subscription", channel: "email",
      subject: "Subscription renewed successfully",
      body: "Hi {{name}},\n\nYour **{{plan}}** has been renewed. New expiry: {{endDate}}.",
      variables: ["name", "plan", "endDate"],
    },
    // Payments
    {
      name: "Payment Success", code: "PAYMENT_SUCCESS",
      category: "payment", channel: "email",
      subject: "Payment of ₹{{amount}} received",
      body: "Hi {{name}},\n\nWe have received your payment of ₹{{amount}} for **{{plan}}**.\n\nTransaction ID: {{txnId}}\n\nThank you!",
      variables: ["name", "amount", "plan", "txnId"],
    },
    {
      name: "Payment Failed", code: "PAYMENT_FAILED",
      category: "payment", channel: "email",
      subject: "Payment failed – Please retry",
      body: "Hi {{name}},\n\nYour payment of ₹{{amount}} failed. Please retry or use a different payment method.",
      variables: ["name", "amount"],
    },
    {
      name: "Payment Refund", code: "PAYMENT_REFUND",
      category: "payment", channel: "email",
      subject: "Refund of ₹{{amount}} initiated",
      body: "Hi {{name}},\n\nA refund of ₹{{amount}} has been initiated and will reflect in 5–7 business days.",
      variables: ["name", "amount"],
    },
    // Wallet
    {
      name: "Wallet Credit", code: "WALLET_CREDIT",
      category: "wallet", channel: "in_app",
      subject: "Wallet credited ₹{{amount}}",
      body: "Your wallet has been credited with ₹{{amount}}. Your updated balance is available in the wallet section.",
      variables: ["amount"],
    },
    {
      name: "Wallet Debit", code: "WALLET_DEBIT",
      category: "wallet", channel: "in_app",
      subject: "Wallet debited ₹{{amount}}",
      body: "₹{{amount}} has been debited from your wallet. If this was not you, please contact support.",
      variables: ["amount"],
    },
    {
      name: "Wallet Low Balance", code: "WALLET_LOW_BALANCE",
      category: "wallet", channel: "in_app",
      subject: "Low wallet balance",
      body: "Your wallet balance is running low. Add funds to continue seamless transactions.",
      variables: [],
    },
    // Projects
    {
      name: "Project Approved", code: "PROJECT_APPROVED",
      category: "project", channel: "in_app",
      subject: "Your project is live!",
      body: "Your project **{{projectTitle}}** has been approved and is now visible to freelancers.",
      variables: ["projectTitle"],
    },
    {
      name: "Project Proposal Received", code: "PROJECT_PROPOSAL_RECEIVED",
      category: "project", channel: "in_app",
      subject: "New proposal received",
      body: "You have received a new proposal from **{{freelancerName}}** on your project **{{projectTitle}}**.",
      variables: ["projectTitle", "freelancerName"],
    },
    {
      name: "Contract Signed", code: "CONTRACT_SIGNED",
      category: "contract", channel: "email",
      subject: "Contract signed – {{contractNumber}}",
      body: "Hi {{name}},\n\nContract **{{contractNumber}}** has been signed. Work can now begin!\n\nProject: {{projectTitle}}",
      variables: ["name", "contractNumber", "projectTitle"],
    },
    // Security
    {
      name: "Login Alert", code: "LOGIN_ALERT",
      category: "security", channel: "email",
      subject: "New login detected on your account",
      body: "Hi {{name}},\n\nA new login was detected from {{device}} at {{time}}.\n\nIf this was not you, please reset your password immediately.",
      variables: ["name", "device", "time"],
    },
    // Marketing / Campaigns
    {
      name: "Welcome", code: "WELCOME",
      category: "marketing", channel: "email",
      subject: "Welcome to Go Experts, {{name}}!",
      body: "Hi {{name}},\n\nWelcome aboard! You're now part of India's fastest-growing expert marketplace.\n\nExplore plans, find talent, or post your first project today.",
      variables: ["name"],
    },
    {
      name: "Campaign General", code: "CAMPAIGN_GENERAL",
      category: "marketing", channel: "email",
      subject: "{{campaignTitle}}",
      body: "{{campaignBody}}",
      variables: ["campaignTitle", "campaignBody"],
    },
    {
      name: "Campaign SMS", code: "CAMPAIGN_SMS",
      category: "marketing", channel: "sms",
      subject: null,
      body: "{{smsBody}}",
      variables: ["smsBody"],
    },
  ];

  const templates: any[] = [];
  for (const t of templateDefs) {
    const tmpl = await prisma.notificationTemplate.upsert({
      where: { code: t.code },
      update: {},
      create: {
        name: t.name,
        code: t.code,
        category: t.category,
        channel: t.channel,
        subject: t.subject,
        body: t.body,
        variables: JSON.stringify(t.variables),
        status: "active",
      },
    });
    templates.push(tmpl);
  }
  console.log(`  ✓ ${templates.length} notification templates`);

  // ─────────────────────────────────────────
  // 2. COMMUNICATION CHANNELS
  // ─────────────────────────────────────────
  console.log("Creating communication channels...");
  const channelDefs = [
    { name: "email", provider: "smtp", config: JSON.stringify({ host: "smtp.gmail.com", port: 587 }) },
    { name: "sms", provider: "fast2sms", config: JSON.stringify({ apiKey: "PLACEHOLDER_KEY" }) },
    { name: "whatsapp", provider: "twilio", config: JSON.stringify({ accountSid: "PLACEHOLDER_SID" }) },
    { name: "push", provider: "firebase", config: JSON.stringify({ projectId: "go-experts" }) },
    { name: "in_app", provider: "internal", config: JSON.stringify({}) },
  ];

  for (const ch of channelDefs) {
    await prisma.communicationChannel.upsert({
      where: { name: ch.name },
      update: {},
      create: ch,
    });
  }
  console.log("  ✓ 5 communication channels");

  // ─────────────────────────────────────────
  // 3. NOTIFICATION PREFERENCES (first 50 users)
  // ─────────────────────────────────────────
  console.log("Creating notification preferences...");
  const users = await prisma.user.findMany({ take: 50, select: { id: true } });
  let prefCount = 0;
  for (const u of users) {
    const existing = await prisma.notificationPreference.findUnique({ where: { userId: u.id } });
    if (!existing) {
      await prisma.notificationPreference.create({
        data: {
          userId: u.id,
          inAppEnabled: true,
          emailEnabled: Math.random() > 0.2,
          smsEnabled: Math.random() > 0.5,
          whatsappEnabled: Math.random() > 0.6,
          pushEnabled: false,
          preferences: JSON.stringify({
            subscription: true, payment: true, wallet: true, project: true, security: true, marketing: false,
            quietHoursStart: pick(["22:00", "23:00", "00:00"]),
            quietHoursEnd: pick(["07:00", "08:00", "06:00"]),
          }),
        },
      });
      prefCount++;
    }
  }
  console.log(`  ✓ ${prefCount} notification preferences`);

  // ─────────────────────────────────────────
  // 4. SAMPLE IN-APP NOTIFICATIONS (100)
  // ─────────────────────────────────────────
  console.log("Creating 100 sample notifications...");
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  const notifTypes = ["subscription", "payment", "wallet", "project", "security", "marketing"];
  const notifTitles = [
    "Subscription activated", "Payment received", "Wallet credited",
    "New proposal received", "Contract signed", "Login alert",
    "Subscription expiring soon", "Refund processed", "Project approved",
  ];
  const notifStatuses = ["queued", "sent", "delivered", "read", "failed"];

  for (let i = 0; i < 100; i++) {
    const u = pick(allUsers);
    const notifType = pick(notifTypes);
    const title = pick(notifTitles);
    const status = pick(notifStatuses);
    await prisma.notification.create({
      data: {
        userId: u.id,
        type: notifType,
        channel: "in_app",
        title,
        message: `This is a sample ${notifType} notification for testing the notification system.`,
        status,
        priority: pick(["low", "normal", "normal", "high"]),
        readAt: status === "read" ? new Date() : null,
        sentAt: ["sent", "delivered", "read"].includes(status) ? addDays(new Date(), -Math.floor(Math.random() * 30)) : null,
        createdAt: addDays(new Date(), -Math.floor(Math.random() * 30)),
      },
    });
  }
  console.log("  ✓ 100 sample notifications");

  // ─────────────────────────────────────────
  // 5. NOTIFICATION CAMPAIGNS (5)
  // ─────────────────────────────────────────
  console.log("Creating 5 notification campaigns...");
  const campaignDefs = [
    {
      title: "Welcome New Users",
      message: "Welcome aboard! Explore plans, find talent, or post your first project today.",
      targetFilter: JSON.stringify({ roles: ["freelancer", "client"] }),
      channels: JSON.stringify(["email"]),
      status: "sent", scheduledAt: addDays(new Date(), -7),
      sentAt: addDays(new Date(), -7),
    },
    {
      title: "Subscription Renewal Reminder",
      message: "Your subscription is expiring soon. Renew now to avoid interruption.",
      targetFilter: JSON.stringify({ roles: ["freelancer", "client", "investor", "founder"], subscriptionStatus: "active" }),
      channels: JSON.stringify(["email", "in_app"]),
      status: "sent", scheduledAt: addDays(new Date(), -3),
      sentAt: addDays(new Date(), -3),
    },
    {
      title: "Diwali Promo Push",
      message: "Celebrate Diwali with 30% off on all subscription plans! Use code DIWALI30.",
      targetFilter: JSON.stringify({ roles: ["freelancer", "client"] }),
      channels: JSON.stringify(["email", "in_app", "whatsapp"]),
      status: "scheduled", scheduledAt: addDays(new Date(), 5),
      sentAt: null,
    },
    {
      title: "SMS Blast – Platform Update",
      message: "Go Experts platform update: New features live! Visit the platform to explore.",
      targetFilter: JSON.stringify({ roles: ["freelancer", "client", "investor", "founder"] }),
      channels: JSON.stringify(["sms"]),
      status: "scheduled", scheduledAt: addDays(new Date(), 2),
      sentAt: null,
    },
    {
      title: "Re-engagement Campaign",
      message: "We miss you! Your subscription expired. Come back and renew at a 20% discount.",
      targetFilter: JSON.stringify({ subscriptionStatus: "expired" }),
      channels: JSON.stringify(["email"]),
      status: "draft", scheduledAt: null,
      sentAt: null,
    },
  ];

  for (const cd of campaignDefs) {
    await prisma.notificationCampaign.create({
      data: {
        title: cd.title,
        message: cd.message,
        targetFilter: cd.targetFilter,
        channels: cd.channels,
        status: cd.status,
        scheduledAt: cd.scheduledAt,
        sentAt: cd.sentAt,
      },
    });
  }
  console.log("  ✓ 5 notification campaigns");

  // ─────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────
  const [tCount, chCount, cCount, nCount, pCount] = await Promise.all([
    prisma.notificationTemplate.count(),
    prisma.communicationChannel.count(),
    prisma.notificationCampaign.count(),
    prisma.notification.count(),
    prisma.notificationPreference.count(),
  ]);

  console.log("\n✅ Notification Engine Seed Complete!\n");
  console.log("═══════════════════════════════════════════");
  console.log(`  🔔 Notification Templates:    ${tCount}`);
  console.log(`  📡 Communication Channels:    ${chCount}`);
  console.log(`  🔕 Notification Preferences:  ${pCount}`);
  console.log(`  📨 Sample Notifications:      ${nCount}`);
  console.log(`  📣 Campaigns:                 ${cCount}`);
  console.log("═══════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("❌ Notification seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
