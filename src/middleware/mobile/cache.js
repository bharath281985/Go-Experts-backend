"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.noCache = exports.cacheControl = void 0;
/**
 * Middleware to set Cache-Control headers for optimizing GET requests.
 *
 * @param duration Duration string (e.g., '5m', '1h', '1d', '30s') or number of seconds.
 * @param isPrivate If true, sets cache-control to private (only cached by the browser, not CDNs).
 */
const cacheControl = (duration, isPrivate = false) => {
    return (req, res, next) => {
        if (req.method !== 'GET') {
            return next();
        }
        let seconds = 0;
        if (typeof duration === 'number') {
            seconds = duration;
        }
        else {
            const match = duration.match(/^(\d+)([smhd])$/);
            if (match) {
                const val = parseInt(match[1], 10);
                switch (match[2]) {
                    case 's':
                        seconds = val;
                        break;
                    case 'm':
                        seconds = val * 60;
                        break;
                    case 'h':
                        seconds = val * 3600;
                        break;
                    case 'd':
                        seconds = val * 86400;
                        break;
                }
            }
        }
        if (seconds > 0) {
            const visibility = isPrivate ? 'private' : 'public';
            res.setHeader('Cache-Control', `${visibility}, max-age=${seconds}`);
        }
        next();
    };
};
exports.cacheControl = cacheControl;
/**
 * Middleware to explicitly disable caching.
 */
const noCache = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
};
exports.noCache = noCache;
