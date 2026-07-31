import { prisma } from "../config/database.js";

async function main() {
  console.log("Updating database email_templates setting...");

  const correctTemplates = [
    {
      id: "tpl_verification_link",
      name: "Verification Link Email",
      subject: "Verify Your Go Experts Account",
      body: "Hello {{full_name}},\n\nPlease click the button below to verify your email address (Link & Code expire in 15 minutes):\n\n{{verification_link}}\n\nThank you,\nGo Experts Team",
      html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #eaedf1; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
  <div style="padding: 24px; text-align: center; border-bottom: 3px solid #E30613;">
    <img src="https://goexperts.in/assets/img/logo.png" alt="Go Experts" style="max-height: 44px;" />
  </div>
  <div style="padding: 32px 24px;">
    <h2 style="color: #1a202c; font-size: 20px; font-weight: 700; margin-bottom: 12px;">Verify Your Email Address</h2>
    <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">Thank you for registering with <strong>Go Experts</strong>. Please click the button below to open your verification page and retrieve your dynamic verification code:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{verification_link}}" target="_blank" style="background-color: #E30613; color: #ffffff; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; text-decoration: none; display: inline-block; box-shadow: 0 4px 12px rgba(227, 6, 19, 0.3);">Verify Email & View Code &rarr;</a>
    </div>
    <div style="background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; text-align: center; font-size: 13px; color: #718096;">
      <p style="margin: 0;">⏰ <strong>Security Notice:</strong> This verification link and OTP code will expire in <strong>15 minutes</strong>.</p>
    </div>
  </div>
</div>`,
      isDefault: true,
    },
    {
      id: "tpl_welcome",
      name: "Welcome Email",
      subject: "Welcome to Go Experts!",
      body: "Hello {{full_name}},\n\nWelcome to Go Experts! We are thrilled to have you onboard.\n\nBest regards,\nGo Experts Team",
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Go Experts!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f6f8; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05); border: 1px solid #eaedf1;">
          <tr>
            <td style="background-color: #ffffff; padding: 28px 32px; text-align: center; border-bottom: 3px solid #E30613;">
              <img src="https://goexperts.in/assets/img/logo.png" alt="Go Experts" style="max-height: 44px; width: auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 32px 20px 32px; text-align: center;">
              <h2 style="color: #1a202c; font-size: 24px; font-weight: 800; margin: 0 0 12px 0;">Welcome to Go Experts! 🎉</h2>
              <p style="font-size: 15px; color: #4a5568; line-height: 1.6; margin: 0;">
                Hello <strong>{{full_name}}</strong>, we are thrilled to welcome you to the Go Experts platform. Connect with top freelancers, verified clients, investors, and innovative startups all in one place.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
                <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #2d3748;">What you can do on Go Experts:</p>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #4a5568; line-height: 1.8;">
                  <li>Post & Hire Top Talent across 50+ categories</li>
                  <li>Discover & Pitch Startup Ideas to Verified Investors</li>
                  <li>Bank-grade Escrow Payment Protection & Contracts</li>
                </ul>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 32px 30px 32px; text-align: center;">
              <a href="{{app_url}}" target="_blank" style="background-color: #E30613; color: #ffffff; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; text-decoration: none; display: inline-block;">
                Explore Go Experts Platform &rarr;
              </a>
            </td>
          </tr>
          <tr>
            <td style="background-color: #fafbfc; padding: 24px 32px; text-align: center; font-size: 12px; color: #718096; border-top: 1px solid #edf2f7;">
              <p style="margin: 0 0 6px 0; font-weight: 600; color: #4a5568;">Go Experts &bull; Working With You. For You.</p>
              <p style="margin: 0;">Need support? Contact us anytime at <a href="mailto:support@goexperts.in" style="color: #E30613; text-decoration: none;">support@goexperts.in</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      isDefault: false,
    },
  ];

  await prisma.setting.upsert({
    where: { key: "settings:section:email_templates" },
    update: { value: JSON.stringify(correctTemplates) },
    create: {
      key: "settings:section:email_templates",
      value: JSON.stringify(correctTemplates),
      category: "email_templates",
    },
  });

  console.log("SUCCESS: Database email_templates setting updated cleanly!");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
