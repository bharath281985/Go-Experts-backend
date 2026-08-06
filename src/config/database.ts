import { PrismaClient } from "@prisma/client";

const primaryUrl =
  process.env.DATABASE_URL ||
  "mysql://expertsportal_apisaiexperts:o%26%7DZVTlWOqLa%25RSE@localhost:3306/expertsportal_adminaigravity";
const fallbackUrl = "mysql://root:@localhost:3306/expertsportal_adminaigravity";

const primaryPrisma = new PrismaClient({
  datasources: { db: { url: primaryUrl } },
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

let fallbackPrisma: PrismaClient | null = null;
let activeClient: PrismaClient = primaryPrisma;

export const prisma = new Proxy(primaryPrisma, {
  get(_target, prop) {
    const model = (activeClient as any)[prop];
    if (typeof model === "object" && model !== null) {
      return new Proxy(model, {
        get(mTarget, mProp) {
          const fn = mTarget[mProp];
          if (typeof fn === "function") {
            return async function (...args: any[]) {
              try {
                return await fn.apply(mTarget, args);
              } catch (err: any) {
                if (
                  err?.message?.includes("Authentication failed against database server") &&
                  activeClient !== fallbackPrisma
                ) {
                  if (!fallbackPrisma) {
                    fallbackPrisma = new PrismaClient({
                      datasources: { db: { url: fallbackUrl } },
                      log: ["error"],
                    });
                  }
                  activeClient = fallbackPrisma;
                  const fallbackModel = (fallbackPrisma as any)[prop];
                  if (fallbackModel && typeof fallbackModel[mProp] === "function") {
                    return await fallbackModel[mProp].apply(fallbackModel, args);
                  }
                }
                throw err;
              }
            };
          }
          return fn;
        },
      });
    }
    if (typeof model === "function") {
      return async function (...args: any[]) {
        try {
          return await model.apply(activeClient, args);
        } catch (err: any) {
          if (
            err?.message?.includes("Authentication failed against database server") &&
            activeClient !== fallbackPrisma
          ) {
            if (!fallbackPrisma) {
              fallbackPrisma = new PrismaClient({
                datasources: { db: { url: fallbackUrl } },
                log: ["error"],
              });
            }
            activeClient = fallbackPrisma;
            const fallbackFn = (fallbackPrisma as any)[prop];
            if (typeof fallbackFn === "function") {
              return await fallbackFn.apply(fallbackPrisma, args);
            }
          }
          throw err;
        }
      };
    }
    return model;
  },
}) as unknown as PrismaClient;

export { getIo } from "../socket/index.js";
