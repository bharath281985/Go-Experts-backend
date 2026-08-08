# Flutter Security Audit Report

## Security Audit Summary
- **Token Security:** Tokens (`accessToken`, `refreshToken`, `role`, `userId`) stored via `flutter_secure_storage`.
- **401 Interceptor:** On 401 Unauthorized, Dio interceptor attempts `POST /auth/refresh` once. If refresh fails, tokens are cleared and user is safely redirected to `/login`.
- **Secrets Management:** Payment secrets, database credentials, and admin API keys are strictly stored backend-side.
- **Sanitized Errors:** User-facing alerts present human-readable messages (e.g., "Email already registered. Please login") and suppress raw Prisma/SQL tracebacks.
