# Founder Master Data Persistence Report

## Step-by-Step Validation (5 Steps)

1. **Step 1 — Account Creation:**
   - Creates `User` record with role `FOUNDER`.
2. **Step 2 — Startup Details:**
   - Captures `startupName`, `industry`, `stage`.
3. **Step 3 — Founder Profile:**
   - Captures `designation` (e.g., Founder, Technical Co-Founder), `country`, `city`.
4. **Step 4 — Startup Goals:**
   - Multi-select from 39-item `startup_goal` master option catalog.
5. **Step 5 — Complete:**
   - Role redirected to `/dashboard/founder`.

## Relational Persistence Results
- **Database Tables:** `User`, `FounderProfile`.
- **Relational Integrity:** Separate storage for user identity vs startup entity.
- **Edit Profile Test:** Correctly pre-populates startup stage and goals.
