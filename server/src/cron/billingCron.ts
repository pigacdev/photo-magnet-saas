import cron from "node-cron";
import {
  runEarlyAccessCleanupJob,
  runEarlyAccessHeadsUpJob,
  runEarlyAccessLoyaltyTransitionJob,
} from "../lib/earlyAccessBillingJobs";

const ENABLE_CRON = process.env.ENABLE_BILLING_CRON === "true";

if (!ENABLE_CRON) {
  console.log("[cron] billing cron is disabled");
} else {
  cron.schedule("0 5 * * *", () => {
    void (async () => {
      console.log("[cron] early-access-loyalty-transition started");
      const result = await runEarlyAccessLoyaltyTransitionJob();
      console.log("[cron] early-access-loyalty-transition completed", result);
    })();
  });

  cron.schedule("0 6 * * *", () => {
    void (async () => {
      console.log("[cron] early-access-cleanup started");
      const result = await runEarlyAccessCleanupJob();
      console.log("[cron] early-access-cleanup completed", result);
    })();
  });

  cron.schedule("0 7 * * *", () => {
    void (async () => {
      console.log("[cron] early-access-heads-up started");
      const result = await runEarlyAccessHeadsUpJob();
      console.log("[cron] early-access-heads-up completed", result);
    })();
  });
}
