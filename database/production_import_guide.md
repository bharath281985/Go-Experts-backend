# Go Experts Production Database
## Import & Reset Guide

**Version:** Phase 11  
**Updated:** July 4, 2026

---

## Prerequisites

```bash
Node.js    >= 18.x
npm        >= 9.x
SQLite3    (for dump operations)
MySQL      (for production migration)
```

---

## Option A: Run the TypeScript Seed Script (Recommended)

This is the safest, cleanest, and most portable approach. It uses Prisma Client to insert all data through the ORM, respecting all constraints.

### Step 1: Install dependencies
```bash
cd backend
npm install
```

### Step 2: Configure environment
```bash
# backend/.env
DATABASE_URL="file:./prisma/dev.db"   # SQLite local
# DATABASE_URL="mysql://user:pass@host:3306/goexperts"  # Production MySQL
```

### Step 3: Validate the schema
```bash
npx prisma validate
```

### Step 4: Reset & migrate (CAUTION: destroys existing data)
```bash
npx prisma db push --force-reset
```

### Step 5: Run the production seeder
```bash
npx tsx prisma/seed-production.ts
```

Expected output:
```
✅ GO EXPERTS PHASE 11 — PRODUCTION DEMO DATABASE COMPLETE!
📦 Total estimated records: ~42,000+
```

**Estimated run time:** 3–5 minutes on local SQLite

---

## Option B: Import the SQL Dump File

Use this approach to quickly restore the demo database on another environment.

### For SQLite (local dev)
```bash
# Reset the database first
npx prisma db push --force-reset

# Import the dump
sqlite3 backend/prisma/dev.db < database/production_demo_seed.sql
```

### For MySQL (production)
```bash
# Create the database first
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS goexperts_production;"

# Import using the standard MySQL dump syntax
# NOTE: The SQL file was generated from SQLite — use mysqlite-to-mysql
# converter or run the TypeScript seeder against MySQL directly

# Recommended: point DATABASE_URL to MySQL and run:
npx tsx prisma/seed-production.ts
```

---

## Option C: Prisma Migrate (Production MySQL)

For clean production migration using Prisma:

```bash
# backend/.env
DATABASE_URL="mysql://user:pass@host:3306/goexperts_production"

# Generate and apply migrations
npx prisma migrate deploy

# Seed the production data
npx tsx prisma/seed-production.ts
```

---

## Reset & Re-seed (Idempotent)

The seed script is **fully idempotent** — it deletes all data in correct FK order before inserting fresh records. Safe to run multiple times:

```bash
cd backend
npx prisma db push --force-reset
npx tsx prisma/seed-production.ts
```

---

## Verify the Seeded Database

### Quick row count check (SQLite)
```bash
sqlite3 backend/prisma/dev.db "
SELECT 'users' AS t, COUNT(*) FROM users
UNION ALL SELECT 'projects', COUNT(*) FROM projects
UNION ALL SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL SELECT 'subscriptions', COUNT(*) FROM subscriptions
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'support_tickets', COUNT(*) FROM support_tickets;"
```

### Expected results
```
users|1600
projects|500
tasks|2500
subscriptions|900
payments|1000
support_tickets|500
```

---

## Verify Backend Build
```bash
cd backend
npm run build
```
Expected: TypeScript compiled with 0 errors.

## Verify Frontend Build
```bash
cd goexperts-nexus
npm run build
```
Expected: Vite produces `dist/` folder with `index.html` and static assets.

---

## Test Admin Login
```bash
curl -X POST https://apiai.goexperts.in/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@goexperts.in","password":"Admin@12345"}'
```
Expected: `{ "token": "eyJ..." }`

---

## Deployment Checklist

- [ ] Backend `.env` has correct `DATABASE_URL`
- [ ] `npx prisma validate` passes
- [ ] `npx prisma db push` or migrations applied
- [ ] `npx tsx prisma/seed-production.ts` runs without errors
- [ ] `npm run build` passes for backend
- [ ] `npm run build` passes for frontend
- [ ] Static `dist/` uploaded to cPanel at `adminai.goexperts.in`
- [ ] Backend PM2 process running on production server
- [ ] API health check `GET /api/health` returns `200 OK`
