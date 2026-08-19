import { prisma } from "../../config/database.js";

export async function activateFreeTrialOnKycApproval(userId: string) {
  try {
    if (!userId) return { success: false, message: "Missing userId" };

    // 1. Fetch user with existing subscriptions
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: {
          where: { status: "active" },
          include: { plan: true },
        },
      },
    });

    if (!user) {
      return { success: false, message: "User not found" };
    }

    // 2. Always mark as verified/active when admin approves, even if trial already exists
    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, verified: true, status: "active" },
    });

    // 3. Send the Account Active email (Email 1) every time admin approves
    try {
      const { sendAccountActiveEmail, sendPlanActivationEmail } = await import("../../services/mobile/email.service.js");
      if (user.email) {
        await sendAccountActiveEmail(user.email, user.fullName || 'User');
        await sendPlanActivationEmail(user.email, user.fullName || 'User');
      }
    } catch (emailErr) {
      console.warn("[FreeTrialService] Could not send approval emails:", emailErr);
    }

    // 4. If user already has an active subscription, just return success (emails already sent)
    const hasActiveSub = user.subscriptions && user.subscriptions.length > 0;
    if (hasActiveSub) {
      console.log(`[FreeTrialService] User ${user.id} already has active subscription. Skipping free trial creation.`);
      return { success: true, message: "User already has active subscription. Approved and emails sent." };
    }

    // 5. Find 90-Day Free Plan (universal "all" role or role-specific)
    const userRole = (user.role || "freelancer").toLowerCase();
    let plan = await prisma.subscriptionPlan.findFirst({
      where: {
        status: "active",
        OR: [
          { role: "all" },
          { role: userRole },
        ],
        AND: [
          {
            OR: [
              { duration: "90_days" },
              { amount: 0 },
            ],
          },
        ],
      },
      orderBy: { amount: "asc" },
    });

    if (!plan) {
      console.warn(`[FreeTrialService] No 90-day free plan found for role: ${userRole}`);
      return { success: false, message: `No active 90-day free plan configured for role: ${userRole}` };
    }

    // 6. Calculate 90 days expiration from now
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    // 7. Create Subscription + Update User trial expiry + Record History
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
        data: { trialEndsAt: endDate },
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

    // 8. In-app notification
    try {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "system",
          title: "🎉 KYC Approved & 90-Day Free Plan Activated!",
          message: `Congratulations ${user.fullName || ""}! Your KYC has been approved. You have been granted a 90-Day Free Access Plan until ${endDate.toLocaleDateString("en-IN")}.`,
          channel: "in_app",
          priority: "high",
          status: "unread",
        },
      });
    } catch (notifErr) {
      console.error("[FreeTrialService] Failed to send notification:", notifErr);
    }

    console.log(`[FreeTrialService] ✅ Activated 90-day free plan for ${user.id} (${user.email}) until ${endDate.toISOString()}`);

    return { success: true, subscription: createdSub, expiresAt: endDate };
  } catch (err: any) {
    console.error("[FreeTrialService] Error activating free trial on KYC approval:", err);
    return { success: false, message: err?.message || "Failed to activate free trial" };
  }
}
