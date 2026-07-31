import { renderEmailTemplate } from "../services/settings/settings.service.js";
import { EmailChannelAdapter } from "../modules/notifications/notification.service.js";

async function main() {
  const rendered = await renderEmailTemplate(
    "tpl_verification_link",
    {
      verification_link: "http://localhost:5175/verify-email?email=saidinesh.goexperts@gmail.com&code=749201",
      otp_code: "749201",
      full_name: "Sai Dinesh",
    },
    { subject: "Verify Your Go Experts Account", html: "Fallback" }
  );

  console.log("RENDERED SUBJECT:", rendered.subject);
  console.log("RENDERED HTML SNIPPET:", rendered.html.substring(0, 300));

  const emailAdapter = new EmailChannelAdapter();
  const res = await emailAdapter.send(
    {
      to: "saidinesh.goexperts@gmail.com",
      subject: rendered.subject,
      body: `Verification Code: 749201\nLink: http://localhost:5175/verify-email?email=saidinesh.goexperts@gmail.com&code=749201`,
      html: rendered.html,
    },
    {}
  );

  console.log("DISPATCH RESULT:", res);
}

main().catch(console.error);
