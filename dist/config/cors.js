import cors from "cors";
export const corsConfig = cors({
    origin: (origin, callback) => {
        // Dynamically reflect requesting origin to allow all frontends (admin, website, mobile webview, local dev)
        callback(null, origin || true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
        "Access-Control-Allow-Headers",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
        "Cache-Control",
        "Pragma",
        "X-CSRF-Token",
    ],
    exposedHeaders: ["*"],
    optionsSuccessStatus: 200,
});
