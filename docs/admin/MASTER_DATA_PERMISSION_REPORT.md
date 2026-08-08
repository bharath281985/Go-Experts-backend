# Master Data RBAC Permission Report

- **Role Authorization:** Access to `/admin/masters` is restricted to users with `SUPER_ADMIN` or `ADMIN` roles.
- **Middleware Enforcement:** All CRUD routes mounted under `/admin/:table` enforce `authMiddleware` and `auditMiddleware("mutate", tableName)`.
- **Audit Logging:** Master modifications (create, update status, delete) record actor ID, timestamp, and entity payload in `audit_logs` MySQL table.
