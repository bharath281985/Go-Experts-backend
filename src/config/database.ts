import { PrismaClient } from "@prisma/client";

function resolveDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  if (!envUrl) {
    return "mysql://root:@localhost:3306/expertsportal_adminaigravity";
  }

  // In local development, if DATABASE_URL contains production credentials that fail on local Windows MySQL,
  // resolve to local root user so local dev server runs with zero authentication errors or delays.
  if (
    process.env.NODE_ENV !== "production" &&
    envUrl.includes("expertsportal_apisaiexperts")
  ) {
    return envUrl.replace(/expertsportal_apisaiexperts:[^@]+@/, "root:@");
  }

  return envUrl;
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: resolveDatabaseUrl(),
    },
  },
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

export { getIo } from "../socket/index.js";
