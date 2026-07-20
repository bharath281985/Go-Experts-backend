/**
 * Route version handler and deprecation notifier middleware.
 * Supports /api/v1, /api/v2 path versions and fallback 'X-API-Version' header.
 * Dispatches a 'Warning' header to clients calling deprecated versions.
 */
export const versionMiddleware = (options) => {
    return (req, res, next) => {
        // 1. Determine requested version from Path or Header
        const pathMatch = req.originalUrl.match(/^\/api\/(v[0-9]+)/i);
        let requestedVersion = pathMatch ? pathMatch[1].toLowerCase() : null;
        if (!requestedVersion) {
            const headerVer = req.headers["x-api-version"] || req.headers["accept-version"];
            if (headerVer) {
                requestedVersion = (typeof headerVer === "string" ? headerVer : headerVer[0]).toLowerCase();
                if (!requestedVersion.startsWith("v")) {
                    requestedVersion = `v${requestedVersion}`;
                }
            }
        }
        // Default to v1 if no version specified
        requestedVersion = requestedVersion || "v1";
        req.apiVersion = requestedVersion;
        // 2. Deprecation check
        if (options.deprecatedVersions?.includes(requestedVersion)) {
            res.setHeader("Warning", `299 - "The requested API version '${requestedVersion}' is deprecated and will be retired soon. Please upgrade to a newer version."`);
            res.setHeader("X-API-Deprecation-Date", "2026-12-31T23:59:59Z");
        }
        // 3. Retirement check
        if (options.retiredVersions?.includes(requestedVersion)) {
            return res.status(410).json({
                success: false,
                message: `The API version '${requestedVersion}' has been retired and is no longer available. Please use a supported version.`,
                requestId: req.requestId || "",
                timestamp: new Date().toISOString(),
            });
        }
        next();
    };
};
