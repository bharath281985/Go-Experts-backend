import "./config/env.js";
import http from "http";
import app from "./app.js";
import { env } from "./config/env.js";
import { startQueueWorker } from "./modules/notifications/notification.service.js";
import { SchedulerService } from "./modules/scheduler/scheduler.service.js";
import { registerSystemJobs } from "./modules/scheduler/system-jobs.js";
import { initSocket } from "./modules/realtime/socket.js";

/**
 * IMPORTANT FOR CPANEL / PHUSION PASSENGER
 * Passenger injects its own PORT environment variable.
 * Do not force only the .env PORT value, otherwise Passenger cannot proxy to the app.
 *
 * Payment gateway env (documented; optional for mock mode):
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 *   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
 *   EASEBUZZ_KEY, EASEBUZZ_SALT
 */
const port = process.env.PORT || env.PORT || 5001;

const server = http.createServer(app);

initSocket(server);

server.listen(port, async () => {
  console.log(`Server running in ${env.NODE_ENV} mode on port ${port}`);

  let isDbConnected = false;

  // Verify Database Connection
  try {
    const { prisma } = await import("./config/database.js");
    await prisma.$connect();
    isDbConnected = true;
    const dbUrl = process.env.DATABASE_URL || "";
    const match = dbUrl.match(/mysql:\/\/(?:[^@]+@)?([^:\/]+)(?::(\d+))?\/([^?]+)/);
    if (match) {
      console.log(`🗄️ Database Connected: MySQL database "${match[3]}" on ${match[1]}:${match[2] || 3306}`);
    } else {
      console.log(`🗄️ Database Connected: ${dbUrl}`);
    }
  } catch (dbErr: any) {
    console.error(`⚠️ Database Connection Warning: Cannot reach MySQL server at localhost:3306`);
    console.error(`👉 Background queue worker and scheduler are paused until database connection is restored.`);
  }

  // Only launch background workers if DB is reachable
  if (isDbConnected) {
    // Start Notification worker
    try {
      startQueueWorker();
    } catch (err) {
      console.error("Failed to start notification queue worker:", err);
    }

    // Register and Start Scheduler Engine
    try {
      registerSystemJobs();
      SchedulerService.startScheduler();
    } catch (err) {
      console.error("Failed to start background job scheduler:", err);
    }
  }
});

server.on("error", (err) => {
  console.error("Server startup error:", err);
});

export default server;
