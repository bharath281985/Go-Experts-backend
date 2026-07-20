import cors from "cors";
import { env } from "./env.js";

function parseCorsOrigins() {
  const fromEnv = String(process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Array.from(
    new Set([
      env.FRONTEND_URL,
      ...fromEnv,
      "https://adminai.goexperts.in",
      "https://goexperts.in",
      "https://www.goexperts.in",
      "http://localhost:8080",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://localhost:3000",
    ]),
  );
}

const allowedOrigins = parseCorsOrigins();

export const corsConfig = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || env.NODE_ENV === "development") {
      return callback(null, true);
    }

    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
});
