import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "mail.goexperts.in",
  port: 465,
  secure: true,
  auth: {
    user: "support@goexperts.in",
    pass: "Goexperts@2025",
  },
  tls: { rejectUnauthorized: false },
});

const welcomeHtml = `
<!DOCTYPE html>
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
          <!-- Header with Logo -->
          <tr>
            <td style="background-color: #ffffff; padding: 28px 32px; text-align: center; border-bottom: 3px solid #E30613;">
              <img src="https://goexperts.in/assets/img/logo.png" alt="Go Experts" style="max-height: 44px; width: auto;" />
            </td>
          </tr>

          <!-- Hero Greeting -->
          <tr>
            <td style="padding: 36px 32px 20px 32px; text-align: center;">
              <h2 style="color: #1a202c; font-size: 24px; font-weight: 800; margin: 0 0 12px 0;">Welcome to Go Experts! 🎉</h2>
              <p style="font-size: 15px; color: #4a5568; line-height: 1.6; margin: 0;">
                We are thrilled to welcome you to the Go Experts platform. Connect with top freelancers, verified clients, investors, and innovative startups all in one place.
              </p>
            </td>
          </tr>

          <!-- Features List -->
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

          <!-- CTA Button -->
          <tr>
            <td style="padding: 10px 32px 30px 32px; text-align: center;">
              <a href="http://localhost:5175" target="_blank" style="background-color: #E30613; color: #ffffff; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; text-decoration: none; display: inline-block; box-shadow: 0 4px 14px rgba(227, 6, 19, 0.3);">
                Explore Go Experts Platform &rarr;
              </a>
            </td>
          </tr>

          <!-- Footer -->
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
</html>
`;

async function run() {
  try {
    const info = await transporter.sendMail({
      from: '"Go Experts Support" <support@goexperts.in>',
      to: "saidinesh.goexperts@gmail.com",
      subject: "Welcome to Go Experts!",
      html: welcomeHtml,
    });
    console.log("WELCOME EMAIL DELIVERED:", info.messageId, info.response);
  } catch (err: any) {
    console.error("FAILED:", err.message);
  }
}

run();
