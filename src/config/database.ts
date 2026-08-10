import { PrismaClient } from "@prisma/client";

function resolveDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  if (!envUrl) {
    return "mysql://root:@localhost:3306/expertsportal_adminaigravity";
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
