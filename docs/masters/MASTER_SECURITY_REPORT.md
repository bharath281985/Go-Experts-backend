# Master Data Security & RBAC Report

- **Role Authorization:** Access to `/admin/masters` is restricted to `SUPER_ADMIN` and `ADMIN` roles.
- **Audit Logging:** Every master mutation (Create, Update, Status Change, Delete) logs actor ID, timestamp, and payload changes to the `audit_logs` MySQL database table.
- **Raw Error Suppression:** Server exceptions return sanitized response envelopes (`MASTER_ALREADY_EXISTS`, `MASTER_IN_USE`) without exposing raw Prisma or SQL stack traces.
