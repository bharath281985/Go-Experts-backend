import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log("🔍 Seeding Phase 6: System Monitoring data...\n");

  // ─────────────────────────────────────────
  // API Request Logs (1000 records)
  // ─────────────────────────────────────────
  const apiMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  const apiEndpoints = [
    "/api/admin/dashboard",
    "/api/admin/users",
    "/api/admin/projects",
    "/api/admin/subscriptions",
    "/api/admin/analytics/dashboard",
    "/api/admin/analytics/users",
    "/api/admin/financials/revenue",
    "/api/admin/notifications",
    "/api/admin/support_tickets",
    "/api/admin/investments",
    "/api/admin/startups",
    "/api/admin/payments",
    "/api/admin/jobs",
    "/api/admin/system/health",
    "/api/admin/system/operations-dashboard",
    "/api/auth/login",
    "/api/auth/refresh",
    "/api/admin/media",
    "/api/admin/reports/custom",
    "/api/admin/automation-rules",
  ];
  const statusCodes = [200, 200, 200, 200, 201, 204, 400, 401, 403, 404, 422, 500];
  const ipPool = [
    "192.168.1.10", "192.168.1.11", "10.0.0.5", "10.0.0.6",
    "172.16.0.2", "172.16.0.3", "203.0.113.5", "198.51.100.1",
  ];
  const agents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "PostmanRuntime/7.36.3",
    "axios/1.6.0",
    "node-fetch/3.3.2",
  ];

  console.log("Creating 1000 API request logs...");
  const apiLogBatches: Promise<any>[] = [];
  for (let i = 0; i < 1000; i++) {
    const method = pick(apiMethods);
    const url = pick(apiEndpoints);
    const statusCode = pick(statusCodes);
    const responseTime = rnd(10, 800);
    const daysAgo = rnd(0, 30);
    const hoursAgo = rnd(0, 23);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);
    createdAt.setHours(createdAt.getHours() - hoursAgo);

    apiLogBatches.push(
      prisma.apiRequestLog.create({
        data: {
          method,
          url,
          statusCode,
          responseTime,
          ipAddress: pick(ipPool),
          userAgent: pick(agents),
          error: statusCode >= 400 ? `HTTP ${statusCode} on ${method} ${url}` : null,
          createdAt,
        },
      })
    );
  }
  await Promise.all(apiLogBatches);
  console.log("✅ 1000 API request logs created.");

  // ─────────────────────────────────────────
  // Login Attempts (100 records)
  // ─────────────────────────────────────────
  const testEmails = [
    "admin@goexperts.com",
    "superadmin@goexperts.com",
    "unknown@hacker.com",
    "test@example.com",
    "manager@goexperts.com",
  ];
  const failReasons = ["Wrong password", "Email not found", "Account suspended"];

  console.log("Creating 100 login attempts...");
  const loginBatches: Promise<any>[] = [];
  for (let i = 0; i < 100; i++) {
    const success = Math.random() > 0.35;
    const daysAgo = rnd(0, 30);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);

    loginBatches.push(
      prisma.loginAttempt.create({
        data: {
          email: pick(testEmails),
          ipAddress: pick(ipPool),
          userAgent: pick(agents),
          success,
          failReason: success ? null : pick(failReasons),
          createdAt,
        },
      })
    );
  }
  await Promise.all(loginBatches);
  console.log("✅ 100 login attempts created.");

  // ─────────────────────────────────────────
  // System Alerts (20 records)
  // ─────────────────────────────────────────
  const alertStatuses = ["active", "active", "acknowledged", "resolved"];

  const alertTemplates = [
    { type: "api_error_rate", severity: "warning", title: "High API Error Rate Detected", message: "API error rate exceeded 5% in the last hour. 47 out of 820 requests returned 4xx/5xx status codes." },
    { type: "api_error_rate", severity: "critical", title: "Critical API Failure Spike", message: "API error rate exceeded 15% in the last 30 minutes. Immediate investigation required." },
    { type: "failed_jobs", severity: "warning", title: "Scheduled Jobs Failing", message: "3 scheduled jobs have failed in the last 24 hours. Check job history for details." },
    { type: "failed_jobs", severity: "critical", title: "Multiple Scheduler Failures", message: "8 jobs failed in the past hour. Scheduler may be experiencing critical issues." },
    { type: "failed_notifications", severity: "warning", title: "Notification Queue Backlog", message: "142 notifications are stuck in failed status. Retry mechanism activated." },
    { type: "failed_notifications", severity: "info", title: "Email Notification Delays", message: "SMTP service experiencing delays. Notifications queued for retry." },
    { type: "failed_logins", severity: "warning", title: "Suspicious Login Activity", message: "12 failed login attempts from IP 203.0.113.5 in the last 30 minutes." },
    { type: "failed_logins", severity: "critical", title: "Potential Brute Force Attack", message: "Over 50 failed login attempts detected from multiple IPs in the past hour." },
    { type: "backup_failed", severity: "critical", title: "Scheduled Backup Failed", message: "Nightly database backup did not complete successfully. Manual backup recommended." },
    { type: "backup_failed", severity: "warning", title: "Backup Size Anomaly", message: "Latest backup size (8.4 MB) is unusually large compared to average (2.1 MB)." },
    { type: "scheduler_stopped", severity: "critical", title: "Job Scheduler Not Responding", message: "Background job scheduler has not executed any jobs in the last 2 hours." },
    { type: "queue_overflow", severity: "warning", title: "Notification Queue Overflow", message: "Pending notification queue exceeded 500 items. Processing may be delayed." },
    { type: "storage_full", severity: "warning", title: "Storage Usage High", message: "Upload directory is using 85% of allocated storage. Consider cleanup or expansion." },
    { type: "storage_full", severity: "critical", title: "Storage Critically Full", message: "Upload directory is at 97% capacity. New file uploads may fail." },
    { type: "db_unavailable", severity: "info", title: "Database Slow Response", message: "Database query response time exceeded 500ms average in the last 15 minutes." },
    { type: "api_error_rate", severity: "info", title: "404 Errors Spike", message: "Increase in 404 Not Found errors detected. Frontend routing may have an issue." },
    { type: "failed_jobs", severity: "info", title: "Cron Job Skipped", message: "The 'Inactive Session Cleanup' job was skipped due to a locking conflict." },
    { type: "failed_notifications", severity: "warning", title: "WhatsApp Delivery Failures", message: "WhatsApp delivery rate dropped to 72% in the last hour (normal: >95%)." },
    { type: "failed_logins", severity: "info", title: "Unusual Login Location", message: "Admin login detected from an unusual IP geolocation (Country: Unknown)." },
    { type: "backup_failed", severity: "info", title: "Backup Schedule Changed", message: "Backup schedule was modified. Next backup is now scheduled for 02:00 UTC." },
  ];

  console.log("Creating 20 system alerts...");
  const alertBatches: Promise<any>[] = [];
  for (const tmpl of alertTemplates) {
    const status = pick(alertStatuses);
    const daysAgo = rnd(0, 14);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);

    alertBatches.push(
      prisma.systemAlert.create({
        data: {
          type: tmpl.type,
          severity: tmpl.severity,
          title: tmpl.title,
          message: tmpl.message,
          status,
          acknowledgedBy: status === "acknowledged" || status === "resolved" ? "system-admin" : null,
          acknowledgedAt: status === "acknowledged" || status === "resolved" ? new Date(createdAt.getTime() + 30 * 60 * 1000) : null,
          resolvedBy: status === "resolved" ? "system-admin" : null,
          resolvedAt: status === "resolved" ? new Date(createdAt.getTime() + 2 * 60 * 60 * 1000) : null,
          createdAt,
        },
      })
    );
  }
  await Promise.all(alertBatches);
  console.log("✅ 20 system alerts created.");

  console.log("\n═══════════════════════════════════════════");
  console.log("✅ Phase 6 System Monitoring Seed Complete!");
  console.log("═══════════════════════════════════════════");
  console.log("  📡 API Request Logs:         1000");
  console.log("  🔐 Login Attempts:           100");
  console.log("  🚨 System Alerts:            20");
  console.log("═══════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
