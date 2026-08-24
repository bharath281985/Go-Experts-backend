import { prisma } from "../../config/database.js";

export const evaluateReferral = async (
  refereeId: string,
  eventType: string,
  eventContext?: any
) => {
  try {
    // 1. Find the active, pending referral for this user
    const referral = await prisma.referral.findFirst({
      where: {
        refereeId,
        status: "PENDING",
      },
      include: {
        referrer: true,
        referee: true,
        campaign: {
          include: {
            rules: true,
          }
        },
      }
    });

    if (!referral) return; // No pending referral found

    const campaign = referral.campaign;
    if (!campaign || campaign.status !== "ACTIVE") return;

    // 2. Find a matching rule for this event and role pair
    const matchingRule = campaign.rules.find(rule => {
      // Must match the event type
      if (rule.qualification !== eventType) return false;

      // Validate Referrer Role
      if (rule.referrerRole !== "ANY" && rule.referrerRole !== referral.referrer.role) return false;

      // Validate Referred (Referee) Role
      if (rule.referredRole !== "ANY" && rule.referredRole !== referral.referee.role) return false;

      // Future Context Validation (e.g., minimum project value)
      // if (rule.conditions) { ... parse JSON and check eventContext ... }

      return true;
    });

    if (!matchingRule) return; // Event doesn't qualify under current rules

    // 3. Atomic Qualification & Reward Creation
    await prisma.$transaction(async (tx) => {
      // Strictly verify idempotency inside transaction
      const currentReferral = await tx.referral.findUnique({
        where: { id: referral.id },
        select: { status: true }
      });

      if (!currentReferral || currentReferral.status !== "PENDING") {
        return; // Already processed or invalidated by another thread
      }

      // Update Referral Status
      await tx.referral.update({
        where: { id: referral.id },
        data: {
          status: "QUALIFIED"
        }
      });

      // Create QUALIFIED ReferralEvent
      await tx.referralEvent.create({
        data: {
          referralId: referral.id,
          eventType: "QUALIFIED",
          metadata: JSON.stringify({
            triggerEvent: eventType,
            ruleId: matchingRule.id,
            context: eventContext,
          })
        }
      });

      // Create Pending Reward (Phase 12B stops here. Phase 12C will handle approval/credit)
      await tx.referralReward.create({
        data: {
          referralId: referral.id,
          amount: matchingRule.rewardAmount,
          rewardType: matchingRule.rewardType,
          status: "PENDING"
        }
      });
    });

    console.log(`[Referral Engine] Successfully qualified referral ${referral.id} for event ${eventType}`);
  } catch (error) {
    console.error("[Referral Engine] Error evaluating qualification:", error);
    // Silent catch - we never want referral failures to break business transactions
  }
};
