# Client / Business Owner Master Data Persistence Report

## Step-by-Step Validation (5 Steps)

1. **Step 1 — Account Creation:**
   - Captures `fullName`, `email`, `mobile`, `password`.
   - `POST /auth/register` creates `User` record with role `CLIENT` and issues JWT token.
2. **Step 2 — Business Details:**
   - Captures `companyName`, `industry`, `companySize`, `country`, `city`.
   - Industry queried from `/v1/mobile/public/industries`.
3. **Step 3 — Professional Profile:**
   - Captures `designation` (from 165 Designations master option catalog).
4. **Step 4 — Team / Budget:**
   - Team size optional; Budget is recommended for project creation rather than mandatory signup.
5. **Step 5 — Complete:**
   - Role redirected to `/dashboard/client`.

## Relational Persistence Results
- **Database Tables:** `User`, `ClientProfile`.
- **Master IDs:** Persisted for Industry, Company Size, and Designation.
- **Edit Profile Test:** Prefills company details and allows inline updates.
