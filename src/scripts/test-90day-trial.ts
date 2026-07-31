import { runTrialReminderCron } from "./trial-reminder-cron.js";

async function main() {
  console.log("Testing 90-Day Free Trial reminder cron...");
  await runTrialReminderCron();
  console.log("Cron execution complete!");
}

main().catch(console.error);
