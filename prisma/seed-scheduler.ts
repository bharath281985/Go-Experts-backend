/**
 * Scheduler & Automation Seed – Phase 4
 * Seeds: ScheduledJobs, AutomationRules, and sample execution metrics.
 * Safe to run on any DB environment.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function calculateNextRun(type: string, cronExpression: string | null): Date | null {
  // Simple next run calculation for seed dates
  const now = new Date();
  if (type === "one_time") return null;
  
  if (cronExpression === "*/1 * * * *") { // every minute
    return new Date(now.getTime() + 60000);
  }
  if (cronExpression?.startsWith("*/30")) { // every 30 mins
    return new Date(now.getTime() + 30 * 60000);
  }
  // Daily / cleanup default next run (tonight / tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

async function main() {
  console.log("🌱 Seeding Scheduler & Automation Engine...\n");

  // ─────────────────────────────────────────
  // 1. SYSTEM SCHEDULED JOBS
  // ─────────────────────────────────────────
  console.log("Creating scheduled jobs...");
  const jobsToSeed = [
    { name: "Subscription Expiry Check", type: "cron", cronExpression: "0 0 * * *", timezone: "UTC" },
    { name: "Subscription Renewal Reminder", type: "cron", cronExpression: "0 12 * * *", timezone: "UTC" },
    { name: "Subscription Grace Period Expiry", type: "cron", cronExpression: "0 1 * * *", timezone: "UTC" },
    { name: "Meeting Reminder", type: "cron", cronExpression: "*/30 * * * *", timezone: "UTC" },
    { name: "Upcoming Interview Reminder", type: "cron", cronExpression: "0 10 * * *", timezone: "UTC" },
    { name: "Invoice Reminder", type: "cron", cronExpression: "0 9 * * *", timezone: "UTC" },
    { name: "Pending Payment Reminder", type: "cron", cronExpression: "0 11 * * *", timezone: "UTC" },
    { name: "Pending Withdrawal Reminder", type: "cron", cronExpression: "0 13 * * *", timezone: "UTC" },
    { name: "Pending Support Ticket Reminder", type: "cron", cronExpression: "0 */4 * * *", timezone: "UTC" },
    { name: "Password Reset Cleanup", type: "cron", cronExpression: "0 2 * * *", timezone: "UTC" },
    { name: "Expired OTP Cleanup", type: "cron", cronExpression: "0 2 * * *", timezone: "UTC" },
    { name: "Inactive Session Cleanup", type: "cron", cronExpression: "0 3 * * *", timezone: "UTC" },
    { name: "Audit Log Cleanup", type: "cron", cronExpression: "0 4 * * 0", timezone: "UTC" },
    { name: "Temporary File Cleanup", type: "cron", cronExpression: "0 5 * * *", timezone: "UTC" },
    { name: "Notification Queue Processing", type: "cron", cronExpression: "*/1 * * * *", timezone: "UTC" },
    { name: "Retry Failed Notifications", type: "cron", cronExpression: "*/10 * * * *", timezone: "UTC" },
    { name: "Retry Failed Emails", type: "cron", cronExpression: "0 */2 * * *", timezone: "UTC" },
    { name: "Retry Failed WhatsApp", type: "cron", cronExpression: "0 */2 * * *", timezone: "UTC" },
    { name: "Retry Failed SMS", type: "cron", cronExpression: "0 */2 * * *", timezone: "UTC" },
    { name: "Retry Failed Push", type: "cron", cronExpression: "0 */2 * * *", timezone: "UTC" },
    { name: "Database Backup", type: "cron", cronExpression: "0 2 * * *", timezone: "UTC" },
  ];

  let jobCount = 0;
  for (const j of jobsToSeed) {
    const existing = await prisma.scheduledJob.findUnique({ where: { name: j.name } });
    if (!existing) {
      const nextRun = calculateNextRun(j.type, j.cronExpression);
      await prisma.scheduledJob.create({
        data: {
          name: j.name,
          type: j.type,
          cronExpression: j.cronExpression,
          timezone: j.timezone,
          status: "active",
          nextRun,
          createdBy: "system",
        },
      });
      jobCount++;
    }
  }
  console.log(`  ✓ ${jobCount} new scheduled jobs created`);

  // ─────────────────────────────────────────
  // 2. AUTOMATION RULES
  // ─────────────────────────────────────────
  console.log("Creating automation rules...");
  const rulesToSeed = [
    {
      name: "Subscription Expired Notification",
      event: "subscription_expired",
      conditions: JSON.stringify({ status: "expired" }),
      actions: JSON.stringify([
        {
          type: "notify",
          channel: "in_app",
          category: "subscription",
          templateCode: "SUBSCRIPTION_EXPIRED",
          recipientId: "{{userId}}",
          variables: { plan: "{{planName}}" },
        },
      ]),
      priority: 10,
    },
    {
      name: "Subscription Renewal Warning",
      event: "subscription_renewal_reminder",
      conditions: JSON.stringify({ days: 3 }),
      actions: JSON.stringify([
        {
          type: "notify",
          channel: "email",
          category: "subscription",
          templateCode: "SUBSCRIPTION_EXPIRY_WARNING",
          recipientId: "{{userId}}",
          variables: {
            name: "{{userName}}",
            plan: "{{planName}}",
            days: "{{days}}",
            endDate: "{{endDate}}",
          },
        },
      ]),
      priority: 8,
    },
    {
      name: "Urgent Support Ticket Warning",
      event: "support_ticket_overdue",
      conditions: JSON.stringify({ priority: "Urgent" }),
      actions: JSON.stringify([
        {
          type: "notify",
          channel: "in_app",
          category: "system",
          title: "Urgent Support Ticket Overdue",
          message: "Support ticket #{{id}} ({{subject}}) is open and requires urgent attention.",
          recipientId: "superadmin@goexperts.com", // system fallback
        },
      ]),
      priority: 15,
    },
    {
      name: "Wallet Debit Alerts",
      event: "wallet_debit",
      conditions: JSON.stringify({}),
      actions: JSON.stringify([
        {
          type: "notify",
          channel: "in_app",
          category: "wallet",
          templateCode: "WALLET_DEBIT",
          recipientId: "{{userId}}",
          variables: { amount: "{{amount}}" },
        },
      ]),
      priority: 5,
    },
  ];

  let ruleCount = 0;
  for (const r of rulesToSeed) {
    const existing = await prisma.automationRule.findUnique({ where: { name: r.name } });
    if (!existing) {
      await prisma.automationRule.create({
        data: {
          name: r.name,
          event: r.event,
          conditions: r.conditions,
          actions: r.actions,
          priority: r.priority,
          status: "active",
          createdBy: "system",
        },
      });
      ruleCount++;
    }
  }
  console.log(`  ✓ ${ruleCount} new automation rules created`);

  // ─────────────────────────────────────────
  // 3. SAMPLE JOB HISTORY & CRON EXECUTIONS (demo history logs)
  // ─────────────────────────────────────────
  console.log("Seeding sample execution logs...");
  const activeJobsList = await prisma.scheduledJob.findMany({ take: 5 });
  let logCount = 0;
  
  for (const job of activeJobsList) {
    const historyExists = await prisma.jobHistory.findFirst({ where: { jobId: job.id } });
    if (!historyExists) {
      // Create 2 history items for each
      await prisma.jobHistory.create({
        data: {
          jobId: job.id,
          status: "success",
          executionTime: Math.floor(Math.random() * 300 + 45),
          errorMessage: null,
          runAt: new Date(Date.now() - 3600000), // 1 hour ago
        },
      });

      await prisma.cronExecution.create({
        data: {
          jobName: job.name,
          status: "success",
          executionTime: Math.floor(Math.random() * 300 + 45),
          errorMessage: null,
          executedAt: new Date(Date.now() - 3600000),
        },
      });
      logCount++;
    }
  }
  console.log(`  ✓ ${logCount} sample execution logs seeded`);

  // Summary counts
  const [jTotal, rTotal, hTotal] = await Promise.all([
    prisma.scheduledJob.count(),
    prisma.automationRule.count(),
    prisma.jobHistory.count(),
  ]);

  console.log("\n✅ Scheduler & Automation Seed Complete!");
  console.log("═══════════════════════════════════════════");
  console.log(`  📅 Scheduled Jobs:           ${jTotal}`);
  console.log(`  🤖 Automation Rules:         ${rTotal}`);
  console.log(`  📝 Execution History Log:    ${hTotal}`);
  console.log("═══════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
