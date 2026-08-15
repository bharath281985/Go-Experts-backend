import { prisma } from "../src/config/database.js";
import { activateFreeTrialOnKycApproval } from "../src/services/subscription/free-trial.service.js";

async function runTest() {
  console.log("=== Testing 90-Day Free Plan on KYC Approval ===");

  const testEmail = `test.freetrial.${Date.now()}@example.com`;

  // 1. Create a test unverified user
  const testUser = await prisma.user.create({
    data: {
      email: testEmail,
      fullName: "Test KYC User",
      role: "freelancer",
      status: "pending",
      isVerified: false,
      verified: false,
    }
  });

  console.log(`1. Created test user: ${testUser.id} (${testUser.email}) - Status: ${testUser.status}, Verified: ${testUser.isVerified}`);

  // 2. Simulate Admin KYC approval
  console.log("2. Simulating Admin KYC approval & activating free trial...");
  const result1 = await activateFreeTrialOnKycApproval(testUser.id);
  console.log("Result of KYC activation:", result1);

  if (!result1.success) {
    throw new Error(`Failed to activate free trial: ${result1.message}`);
  }

  // 3. Verify in database
  const updatedUser = await prisma.user.findUnique({
    where: { id: testUser.id },
    include: {
      subscriptions: {
        include: { plan: true }
      },
      subscriptionHistories: true,
      notifications: true
    }
  });

  console.log("3. Database State after KYC approval:");
  console.log(`- User status: ${updatedUser?.status}`);
  console.log(`- User isVerified: ${updatedUser?.isVerified}`);
  console.log(`- User trialEndsAt: ${updatedUser?.trialEndsAt}`);
  console.log(`- Active subscriptions count: ${updatedUser?.subscriptions?.length}`);
  if (updatedUser?.subscriptions?.[0]) {
    const sub = updatedUser.subscriptions[0];
    console.log(`- Subscription Plan: ${sub.plan.name} (${sub.plan.role}) - Price: ₹${sub.plan.amount}`);
    console.log(`- Start Date: ${sub.startDate}`);
    console.log(`- End Date: ${sub.endDate}`);
  }
  console.log(`- History entries: ${updatedUser?.subscriptionHistories?.length}`);
  console.log(`- Notifications received: ${updatedUser?.notifications?.length}`);

  // 4. Test One-Time Lifetime constraint (Attempt to activate second time)
  console.log("\n4. Testing One-Time Lifetime Constraint (attempting 2nd activation)...");
  const result2 = await activateFreeTrialOnKycApproval(testUser.id);
  console.log("Result of 2nd activation attempt:", result2);

  if (result2.success) {
    throw new Error("FAIL: 2nd free trial activation succeeded when it should have been blocked!");
  } else {
    console.log("✅ PASS: 2nd activation was correctly rejected:", result2.message);
  }

  // 5. Cleanup test user
  console.log("\n5. Cleaning up test user...");
  await prisma.user.delete({
    where: { id: testUser.id }
  });
  console.log("✅ Test user cleaned up. All test assertions passed!");
}

runTest()
  .catch((err) => {
    console.error("❌ Test Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
