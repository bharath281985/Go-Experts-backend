import dotenv from "dotenv";
import { z } from "zod";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Always load .env from the project root, then allow environment-specific
// overrides such as .env.development and .env.production.
const rootDir = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(rootDir, ".env") });
dotenv.config({
    path: path.join(rootDir, `.env.${process.env.NODE_ENV || "development"}`),
    override: true,
});
const envSchema = z.object({
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(8),
    JWT_REFRESH_SECRET: z.string().min(8),
    PORT: z.coerce.number().default(5000),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    FRONTEND_URL: z.string().url().default("http://localhost:8080"),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error("❌ Invalid environment variables:", parsed.error.format());
    process.exit(1);
}
export const env = parsed.data;
