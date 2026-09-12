import { prisma } from "../config/database.js";

async function main() {
  console.log("Updating database email_templates setting...");

  const correctTemplates = [
    {
      id: "tpl_verification_link",
      name: "Verification Link Email",
      subject: "Verify Your Go Experts Account",
      body: "Hello {{full_name}},\n\nPlease click the button below to verify your email address (Link & Code expire in 15 minutes):\n\n{{verification_link}}\n\nThank you,\nGo Experts Team",
      html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GoExperts</title>
  <style type="text/css">
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;display:block}
    body{margin:0!important;padding:0!important;width:100%!important;background-color:#eef2f7}
    @media only screen and (max-width:620px){.email-container{width:100%!important}.app-badge-td{display:block!important;text-align:center!important;padding:6px 0!important}}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:Inter,'Helvetica Neue',Arial,sans-serif;">
  <div style="display:none;font-size:1px;color:#eef2f7;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Verify your GoExperts account email to get started.&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="background-color:#eef2f7;">
    <tr><td style="padding:40px 16px;">
      <table role="presentation" class="email-container" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="max-width:600px;margin:auto;border-radius:14px;box-shadow:0 4px 24px rgba(15,23,42,0.10);">
        <!-- HEADER -->
        <tr>
          <td style="background:#ffffff;border-radius:14px 14px 0 0;padding:0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="padding:20px 32px;vertical-align:middle;">
                  <a href="https://goexperts.in" target="_blank" style="text-decoration:none;display:inline-block;">
                    <img src="https://goexperts.in/logo.png" alt="GoExperts" width="160" style="border:0;outline:none;text-decoration:none;display:block;max-width:160px;height:auto;" />
                  </a>
                </td>
                <td align="right" style="padding:20px 32px;vertical-align:middle;">
                  <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;font-family:Inter,Arial,sans-serif;">Email Verification</div>
                  <div style="color:#94a3b8;font-size:10px;font-family:Inter,Arial,sans-serif;margin-top:3px;">Working With You. For You.</div>
                </td>
              </tr>
              <tr><td colspan="2" style="padding:0;"><div style="height:3px;background:linear-gradient(90deg,#c0392b 0%,#e74c3c 50%,#1a2e5a 100%);"></div></td></tr>
            </table>
          </td>
        </tr>
        <!-- BODY -->
        <tr>
          <td style="background:#ffffff;padding:44px 40px 36px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
            <p style="margin:0 0 4px;color:#64748b;font-size:13px;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;font-family:Inter,Arial,sans-serif;">Email Verification</p>
            <h1 style="margin:0 0 8px;color:#0f172a;font-size:26px;font-weight:800;line-height:1.2;font-family:Inter,Arial,sans-serif;">Verify Your Email Address 📧</h1>
            <p style="margin:0 0 24px;color:#64748b;font-size:15px;font-family:Inter,Arial,sans-serif;">Thank you for registering with <strong>GoExperts</strong>. Please click the button below to verify your email address and retrieve your OTP verification code:</p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:28px auto;">
              <tr>
                <td style="border-radius:8px;background-color:#c0392b;" align="center">
                  <a href="{{verification_link}}" target="_blank" style="background-color:#c0392b;color:#ffffff;font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:700;line-height:50px;text-align:center;text-decoration:none;display:inline-block;border-radius:8px;padding:0 32px;min-width:220px;">Verify Email &amp; View Code &rarr;</a>
                </td>
              </tr>
            </table>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fff7ed;border-left:4px solid #f97316;border-radius:0 8px 8px 0;margin:0 0 24px;">
              <tr><td style="padding:14px 18px;">
                <p style="margin:0 0 4px;color:#92400e;font-size:13px;font-weight:700;font-family:Inter,Arial,sans-serif;">⏰ Security Notice</p>
                <p style="margin:0;color:#78350f;font-size:13px;line-height:1.6;font-family:Inter,Arial,sans-serif;">This verification link and OTP code will expire in <strong>15 minutes</strong>. Do not share it with anyone.</p>
              </td></tr>
            </table>
            <p style="margin:0 0 8px;color:#64748b;font-size:13px;font-family:Inter,Arial,sans-serif;">Button not working? Copy and paste this link:</p>
            <p style="margin:0 0 24px;"><a href="{{verification_link}}" style="color:#c0392b;font-size:12px;word-break:break-all;text-decoration:none;font-family:Inter,Arial,sans-serif;">{{verification_link}}</a></p>
            <p style="margin:0;color:#374151;font-size:13px;font-weight:600;font-family:Inter,Arial,sans-serif;">The GoExperts Team</p>
          </td>
        </tr>
        <!-- FOOTER: Info Bar -->
        <tr>
          <td style="background:#0d766e;padding:18px 36px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:middle;"><a href="https://goexperts.in" style="color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;font-family:Inter,Arial,sans-serif;">🌐 www.goexperts.in</a></td>
                <td align="right" style="vertical-align:middle;"><a href="mailto:servicedesk@goexperts.in" style="color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;font-family:Inter,Arial,sans-serif;">📧 servicedesk@goexperts.in</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- FOOTER: App Download -->
        <tr>
          <td style="background:#f8fafc;padding:24px 36px;text-align:center;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
            <p style="margin:0 0 6px;color:#374151;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;font-family:Inter,Arial,sans-serif;">Download Our App</p>
            <p style="margin:0 0 16px;color:#94a3b8;font-size:12px;font-family:Inter,Arial,sans-serif;">Manage your account, projects &amp; connections on the go</p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
              <tr>
                <td class="app-badge-td" style="padding:0 8px 0 0;vertical-align:middle;">
                  <a href="https://play.google.com/store" target="_blank" style="text-decoration:none;display:inline-block;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                      <td style="background:#1a1a2e;border-radius:9px;border:1px solid #2d2d44;padding:9px 18px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                          <td style="padding-right:10px;vertical-align:middle;"><div style="width:0;height:0;border-top:12px solid transparent;border-bottom:12px solid transparent;border-left:20px solid #4ade80;"></div></td>
                          <td style="vertical-align:middle;">
                            <div style="color:#9ca3af;font-size:9px;letter-spacing:0.5px;text-transform:uppercase;font-family:Inter,Arial,sans-serif;">GET IT ON</div>
                            <div style="color:#ffffff;font-size:15px;font-weight:700;font-family:Inter,Arial,sans-serif;">Google Play</div>
                          </td>
                        </tr></table>
                      </td>
                    </tr></table>
                  </a>
                </td>
                <td class="app-badge-td" style="padding:0 0 0 8px;vertical-align:middle;">
                  <a href="https://apps.apple.com" target="_blank" style="text-decoration:none;display:inline-block;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                      <td style="background:#1a1a2e;border-radius:9px;border:1px solid #2d2d44;padding:9px 18px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                          <td style="padding-right:10px;vertical-align:middle;font-size:22px;color:#ffffff;font-family:Arial,sans-serif;">&#63743;</td>
                          <td style="vertical-align:middle;">
                            <div style="color:#9ca3af;font-size:9px;letter-spacing:0.5px;text-transform:uppercase;font-family:Inter,Arial,sans-serif;">Download on the</div>
                            <div style="color:#ffffff;font-size:15px;font-weight:700;font-family:Inter,Arial,sans-serif;">App Store</div>
                          </td>
                        </tr></table>
                      </td>
                    </tr></table>
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- FOOTER: Social + Copyright -->
        <tr>
          <td style="background:#f1f5f9;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 14px 14px;padding:20px 36px 24px;text-align:center;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin-bottom:14px;">
              <tr>
                <td style="padding:0 6px;"><a href="https://linkedin.com/company/goexperts" target="_blank" style="text-decoration:none;"><div style="width:34px;height:34px;background:#0a66c2;border-radius:8px;text-align:center;line-height:34px;font-size:15px;color:#ffffff;font-weight:700;font-family:Arial,sans-serif;">in</div></a></td>
                <td style="padding:0 6px;"><a href="https://twitter.com/goexperts" target="_blank" style="text-decoration:none;"><div style="width:34px;height:34px;background:#000;border-radius:8px;text-align:center;line-height:34px;font-size:16px;color:#fff;font-weight:900;font-family:Arial,sans-serif;">&#120143;</div></a></td>
                <td style="padding:0 6px;"><a href="https://instagram.com/goexperts" target="_blank" style="text-decoration:none;"><div style="width:34px;height:34px;background:linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);border-radius:8px;text-align:center;line-height:34px;font-size:18px;">📷</div></a></td>
              </tr>
            </table>
            <p style="margin:0 0 10px;color:#475569;font-size:13px;font-weight:600;font-family:Inter,Arial,sans-serif;">GoExperts &mdash; Connect. Build. Scale. Globally.</p>
            <p style="margin:0 0 6px;color:#94a3b8;font-size:11px;font-family:Inter,Arial,sans-serif;">
              <a href="https://goexperts.in/privacy" style="color:#94a3b8;text-decoration:none;">Privacy Policy</a> &bull;
              <a href="https://goexperts.in/terms" style="color:#94a3b8;text-decoration:none;">Terms of Service</a> &bull;
              <a href="https://goexperts.in/settings/notifications" style="color:#94a3b8;text-decoration:none;">Unsubscribe</a>
            </p>
            <p style="margin:0;color:#cbd5e1;font-size:11px;font-family:Inter,Arial,sans-serif;">&copy; 2025 GoExperts Private Limited. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
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
              <p style="margin: 0;">Need support? Contact us anytime at <a href="mailto:servicedesk@goexperts.in" style="color: #E30613; text-decoration: none;">servicedesk@goexperts.in</a></p>
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
