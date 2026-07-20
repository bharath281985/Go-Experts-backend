# Database Setup and Import Instructions

Follow these instructions to reset your local database, run the complete master seeding script, or import the SQL dump directly.

---

## 🛠 Local Prisma Setup & Seeding

Ensure you are in the `backend` workspace directory of the project:

```bash
cd backend
```

### Step 1: Install Dependencies
Ensure that all developer dependencies (such as `tsx` and the Prisma Client) are installed:
```bash
npm install
```

### Step 2: Validate the Prisma Schema
Ensure your schema contains no syntax errors:
```bash
npx prisma validate
```

### Step 3: Reset and Sync the Database
To clear all data, apply any pending schema changes, and sync the local SQLite database (`prisma/dev.db`), run:
```bash
npx prisma db push --force-reset
```

### Step 4: Run the Complete Master Seed
Run the typescript master database seed script:
```bash
npx tsx prisma/seed-master.ts
```

This completes the setup. You can now start the local development server:
```bash
npm run dev
```

---

## 💾 Importing the SQL Dump

A full SQL dump containing the schema and tables populated by the master seed is available at:
`database/goexperts_master_seed.sql`

### Option A: Direct SQLite Import (to reconstruct `dev.db`)
If you want to reconstruct the SQLite database from the `.sql` dump directly using `sqlite3`:

```bash
# Deletes old db if exists
rm backend/prisma/dev.db

# Imports database schema and data
sqlite3 backend/prisma/dev.db < database/goexperts_master_seed.sql
```

### Option B: Importing to MySQL (or similar Relational Databases)
If you are transitioning the backend datasource provider to MySQL in `schema.prisma` for production:

1. Open your terminal.
2. Run the MySQL CLI tool to import the database script into your target database:
   ```bash
   mysql -u [username] -p [database_name] < database/goexperts_master_seed.sql
   ```
3. Update the `DATABASE_URL` environment variable inside your `.env` file to point to your new MySQL instance.
