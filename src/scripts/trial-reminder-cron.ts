import { prisma } from "../config/database.js";
import { renderEmailTemplate } from "../services/settings/settings.service.js";
import { EmailChannelAdapter } from "../modules/notifications/notification.service.js";

/**
 * Daily Trial Expiration Reminder Service.
 * Sends automated daily email notifications to users whose 90-day free trial expires in <= 10 days.
 */
export async function runTrialReminderCron() {
  console.log("[TRIAL CRON] Running daily 90-day free trial expiration check...");

  try {
    const now = new Date();
    const tenDaysFromNow = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

    // Find users whose trial is active and expires in <= 10 days
    const expiringUsers = await prisma.user.findMany({
      where: {
        trialEndsAt: {
          gt: now,
          lte: tenDaysFromNow,
        },
        status: "active",
      },
    });

    console.log(`[TRIAL CRON] Found ${expiringUsers.length} users with expiring free trials.`);

    const emailAdapter = new EmailChannelAdapter();

    let parsedConfig = {};
    try {
      const chanConfig = await prisma.communicationChannel.findUnique({
        where: { name: "email" },
      });
      if (chanConfig && chanConfig.config) {
        parsedConfig = JSON.parse(chanConfig.config);
      }
    } catch {
      // fallback
    }

    for (const u of expiringUsers) {
      if (!u.trialEndsAt) continue;

      const msRemaining = u.trialEndsAt.getTime() - now.getTime();
      const daysLeft = Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
      const expiryDateStr = u.trialEndsAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const clientHost = process.env.CLIENT_URL || "https://goexperts.in";

      const rendered = await renderEmailTemplate(
        "tpl_trial_expiry_warning",
        {
          full_name: u.fullName,
          days_left: String(daysLeft),
          trial_ends_at: expiryDateStr,
          pricing_url: `${clientHost}/pricing`,
          role: u.role.toUpperCase(),
        },
        {
          subject: `Notice: Your Go Experts Free Trial expires in ${daysLeft} days`,
          html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; overflow: hidden;">
              <div style="padding: 24px; text-align: center; border-bottom: 3px solid #E30613;">
                <img src="https://goexperts.in/assets/img/logo.png" alt="Go Experts" style="max-height: 44px;" />
              </div>
              <div style="padding: 32px 24px;">
                <h2 style="color: #1a202c; font-size: 20px; font-weight: 700; margin-bottom: 12px;">Trial Expiration Notice</h2>
                <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">Hello <strong>${u.fullName}</strong>,</p>
                <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">This is a reminder that your <strong>90-Day Free Trial</strong> on Go Experts will expire in <strong style="color: #E30613;">${daysLeft} days</strong> (on <strong>${expiryDateStr}</strong>).</p>

                <div style="background-color: #fff5f5; border: 1px solid #fed7d7; border-radius: 10px; padding: 20px; margin: 24px 0;">
                  <h3 style="margin: 0 0 8px 0; color: #c53030; font-size: 15px; font-weight: 700;">⚠️ Keep Full Platform Access</h3>
                  <p style="margin: 0; font-size: 13px; color: #742a2a; line-height: 1.5;">To avoid interruption to your messaging, projects, or startup pitches, please select a subscription plan before your trial ends.</p>
                </div>

                <div style="text-align: center; margin-top: 32px;">
                  <a href="${clientHost}/pricing" target="_blank" style="background-color: #E30613; color: #ffffff; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; text-decoration: none; display: inline-block;">View Subscription Plans & Upgrade &rarr;</a>
                </div>
              </div>
            </div>
          `,
        }
      );

      await emailAdapter.send(
        {
          to: u.email,
          subject: rendered.subject,
          body: `Hello ${u.fullName},\n\nYour 90-Day Free Trial expires in ${daysLeft} days on ${expiryDateStr}.\nPlease upgrade your plan at ${clientHost}/pricing to continue enjoying platform features.\n\nBest regards,\nGo Experts Team`,
          html: rendered.html,
        },
        parsedConfig
      );

      console.log(`[TRIAL CRON SUCCESS] Sent ${daysLeft}-day expiry reminder to ${u.email}`);
    }
  } catch (err) {
    console.error("[TRIAL CRON ERROR]", err);
  }
}
