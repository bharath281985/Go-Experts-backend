import { prisma } from "../../config/database.js";

export async function activateFreeTrialOnKycApproval(userId: string) {
  try {
    if (!userId) return { success: false, message: "Missing userId" };

    // 1. Fetch user with existing subscriptions and trial info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: {
          include: { plan: true },
        },
      },
    });

    if (!user) {
      return { success: false, message: "User not found" };
    }

    // 2. One-time lifetime check:
    // If user has trialEndsAt set OR already has any active/historical subscription, do not give free trial again.
    if (user.trialEndsAt) {
      return {
        success: false,
        message: "User has already claimed their 90-day free trial.",
      };
    }

    const hasAnyExistingSub = user.subscriptions && user.subscriptions.length > 0;
    if (hasAnyExistingSub) {
      return {
        success: false,
        message: "User already has a subscription on record.",
      };
    }

    // 3. Find 90-Day Free Plan for this user's role
    const userRole = (user.role || "freelancer").toLowerCase();
    let plan = await prisma.subscriptionPlan.findFirst({
      where: {
        role: userRole,
        status: "active",
        OR: [
          { duration: "90_days" },
          { amount: 0 },
        ],
      },
    });

    // Fallback to role "all" if role-specific not found
    if (!plan) {
      plan = await prisma.subscriptionPlan.findFirst({
        where: {
          role: "all",
          status: "active",
          OR: [
            { duration: "90_days" },
            { amount: 0 },
          ],
        },
      });
    }

    if (!plan) {
      console.warn(`[FreeTrialService] No 90-day free plan found in database for role: ${userRole}`);
      return {
        success: false,
        message: `No active 90-day free plan configured for role: ${userRole}`,
      };
    }

    // 4. Calculate 90 days expiration from now
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    // 5. Execute transaction: Create Subscription + Update User + Record History
    const [createdSub] = await prisma.$transaction([
      prisma.subscription.create({
        data: {
          userId: user.id,
          planId: plan.id,
          startDate,
          endDate,
          status: "active",
          autoRenew: false,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          trialEndsAt: endDate,
          isVerified: true,
          verified: true,
          status: "active",
        },
      }),
      prisma.subscriptionHistory.create({
        data: {
          userId: user.id,
          planId: plan.id,
          action: "FREE_TRIAL_ACTIVATED_ON_KYC",
          metadata: JSON.stringify({
            grantedAt: startDate.toISOString(),
            expiresAt: endDate.toISOString(),
            durationDays: 90,
            planName: plan.name,
            role: userRole,
          }),
        },
      }),
    ]);

    // 6. Send in-app notification to user
    try {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "system",
          title: "🎉 KYC Approved & 90-Day Free Plan Activated!",
          message: `Congratulations ${user.fullName || ""}! Your KYC verification has been approved by the Admin. You have been granted a 90-Day Free Access Plan until ${endDate.toLocaleDateString("en-IN")}.`,
          channel: "in_app",
          priority: "high",
          status: "unread",
        },
      });
    } catch (notifErr) {
      console.error("[FreeTrialService] Failed to send notification:", notifErr);
    }

    console.log(
      `[FreeTrialService] ✅ Successfully activated 90-day free plan for user ${user.id} (${user.fullName || user.email}) until ${endDate.toISOString()}`
    );

    return {
      success: true,
      subscription: createdSub,
      expiresAt: endDate,
    };
  } catch (err: any) {
    console.error("[FreeTrialService] Error activating free trial on KYC approval:", err);
    return { success: false, message: err?.message || "Failed to activate free trial" };
  }
}
