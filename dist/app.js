import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { rateLimit } from "express-rate-limit";
import { corsConfig } from "./config/cors.js";
import { UPLOADS_DIR, ensureUploadsDir } from "./config/uploads.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { apiLoggerMiddleware } from "./middlewares/api-logger.middleware.js";
import apiRoutes from "./routes/index.js";
const app = express();
ensureUploadsDir();
// ==========================================
// Security
// ==========================================
app.use(helmet({
    crossOriginResourcePolicy: false,
}));
app.use(corsConfig);
// ==========================================
// Rate Limiter
// ==========================================
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: {
        success: false,
        message: "Too many requests from this IP. Please try again later.",
    },
});
app.use("/api", limiter);
// ==========================================
// Middleware
// ==========================================
app.use(morgan("dev"));
// Capture raw body for Stripe webhooks (signature verification)
app.use(express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
        if (req.url && req.url.includes("/payments/webhooks/stripe")) {
            req.rawBody = buf;
        }
    },
}));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
// ==========================================
// Static Uploads
// ==========================================
app.use("/uploads", express.static(UPLOADS_DIR));
// ==========================================
// Root Endpoint
// ==========================================
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Go Experts Admin AI API is running",
        status: "Healthy",
        version: "1.0.0",
        timestamp: new Date(),
    });
});
// ==========================================
// Health Endpoints
// ==========================================
app.get("/health", (req, res) => {
    res.json({
        success: true,
        status: "Healthy",
        timestamp: new Date(),
    });
});
app.get("/api", (req, res) => {
    res.json({
        success: true,
        application: "Go Experts Admin API",
        version: "1.0.0",
        status: "Running",
        docs: "/api/docs/openapi.json",
        postman: "/api/docs/postman.json",
        health: "/api/health",
        timestamp: new Date(),
    });
});
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        status: "Healthy",
        timestamp: new Date(),
    });
});
// ==========================================
// API Logger
// ==========================================
app.use("/api", apiLoggerMiddleware);
// ==========================================
// API Routes
// ==========================================
app.use("/api", apiRoutes);
// ==========================================
// Global Error Handler
// ==========================================
app.use(errorMiddleware);
export default app;
