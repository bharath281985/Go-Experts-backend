import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log("🌱 Seeding Phase 7: Developer Platform data...\n");

  // 1. Api Versions
  console.log("Seeding API Versions...");
  const v1 = await prisma.apiVersion.upsert({
    where: { version: "v1" },
    update: {},
    create: {
      version: "v1",
      status: "deprecated",
      deprecatedAt: new Date(),
    },
  });

  const v2 = await prisma.apiVersion.upsert({
    where: { version: "v2" },
    update: {},
    create: {
      version: "v2",
      status: "active",
    },
  });

  // 2. API Changelog
  console.log("Seeding API Changelog...");
  await prisma.apiChangelog.createMany({
    data: [
      {
        versionId: v1.id,
        title: "Initial API Launch",
        description: "Standardized v1 REST endpoints for authentication and system diagnostics.",
        isBreaking: false,
      },
      {
        versionId: v2.id,
        title: "Response Standardization",
        description: "All endpoints upgraded to return success, message, data, and meta envelopes.",
        isBreaking: true,
      },
      {
        versionId: v2.id,
        title: "Role-Based Scopes Guarding",
        description: "Granular scope checks implemented for developer credentials.",
        isBreaking: false,
      },
    ],
  });

  // 3. API Keys (Generate 5 keys)
  console.log("Creating API Keys...");
  const keyNames = [
    "Production Main Integrator",
    "Staging Sync Client",
    "Flutter Mobile App Client",
    "Support Portal Read Key",
    "Third Party Web Widget",
  ];
  const scopesPool = ["read:all", "read:all,write:projects", "write:all", "admin", "read:financials"];
  const rolesPool = ["superadmin", "admin", "manager", "api_partner"];

  const createdKeys = [];
  for (const name of keyNames) {
    const rawKey = `gk_live_${crypto.randomBytes(24).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const maskedKey = `${rawKey.slice(0, 12)}...${rawKey.slice(-4)}`;
    
    const key = await prisma.apiKey.create({
      data: {
        name,
        keyHash,
        maskedKey,
        scopes: pick(scopesPool),
        roleMapping: pick(rolesPool),
        usageCount: rnd(50, 2000),
        status: "active",
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days out
      },
    });
    createdKeys.push(key);
  }
  console.log(`✅ Created ${createdKeys.length} API Keys.`);

  // 4. Webhooks & Events & Deliveries
  console.log("Creating Webhooks...");
  const webhookTargets = [
    { name: "External CRM Integration", url: "https://crm.externalclient.com/webhooks/incoming" },
    { name: "Slack Alerts Webhook", url: "https://hooks.slack.com/services/T00000000/B00000000/XXXXXX" },
    { name: "Accounting Analytics System", url: "https://finance-sync.internal.net/api/v1/ingest" },
  ];
  const eventsPool = [
    "user.created", "user.updated",
    "project.created", "project.approved",
    "proposal.submitted", "proposal.accepted",
    "contract.created", "task.completed",
    "payment.success", "subscription.purchased",
  ];

  for (const wt of webhookTargets) {
    const hook = await prisma.webhook.create({
      data: {
        name: wt.name,
        url: wt.url,
        secret: `whsec_${crypto.randomBytes(20).toString("hex")}`,
        status: "active",
      },
    });

    // Subscribe to 3 random events
    const selectedEvents = Array.from(new Set([pick(eventsPool), pick(eventsPool), pick(eventsPool)]));
    for (const event of selectedEvents) {
      await prisma.webhookEvent.create({
        data: {
          webhookId: hook.id,
          event,
        },
      });
    }

    // Generate 15 delivery logs
    console.log(`Generating webhook deliveries for ${wt.name}...`);
    for (let i = 0; i < 15; i++) {
      const isSuccess = Math.random() > 0.15;
      await prisma.webhookDelivery.create({
        data: {
          webhookId: hook.id,
          event: pick(selectedEvents),
          payload: JSON.stringify({ event: "test.seeding", timestamp: new Date(), data: { mockId: crypto.randomUUID() } }),
          statusCode: isSuccess ? 200 : pick([400, 404, 500, 502, 503]),
          responseBody: isSuccess ? "{\"status\":\"ok\"}" : "Internal Server Error or Bad Request",
          duration: rnd(40, 500),
          status: isSuccess ? "success" : "failed",
          retryCount: isSuccess ? 0 : rnd(1, 3),
        },
      });
    }
  }

  // 5. API Usage Logs (500 records)
  console.log("Generating API Usage Logs...");
  const usageEndpoints = [
    "/api/v2/admin/dashboard",
    "/api/v2/admin/users",
    "/api/v2/admin/projects",
    "/api/v2/admin/subscriptions",
    "/api/v2/admin/developer/dashboard",
    "/api/v2/auth/login",
    "/api/v2/admin/media",
    "/api/v2/admin/reports/custom",
  ];
  const usageMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  const usageStatusCodes = [200, 200, 200, 201, 204, 400, 401, 403, 404, 429, 500];

  const usageBatches = [];
  for (let i = 0; i < 500; i++) {
    const daysAgo = rnd(0, 30);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);

    usageBatches.push(
      prisma.apiUsageLog.create({
        data: {
          apiKeyId: pick(createdKeys).id,
          ipAddress: `192.168.1.${rnd(10, 250)}`,
          method: pick(usageMethods),
          route: pick(usageEndpoints),
          apiVersion: "v2",
          statusCode: pick(usageStatusCodes),
          responseTime: rnd(15, 600),
          createdAt,
        },
      })
    );
  }
  await Promise.all(usageBatches);

  console.log("\n═══════════════════════════════════════════");
  console.log("✅ Phase 7 Developer Platform Seed Complete!");
  console.log("═══════════════════════════════════════════");
  console.log(`  🌐 API Versions:             2`);
  console.log(`  📖 Changelogs:               3`);
  console.log(`  🔑 API Keys:                 5`);
  console.log(`  🔗 Webhooks:                 3`);
  console.log(`  📨 Webhook Deliveries:       45`);
  console.log(`  📊 API Usage Logs:           500`);
  console.log("═══════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
