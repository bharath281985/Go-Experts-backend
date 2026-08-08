# Flutter Founder Mobile Signup Report

## Step-by-Step Flow Specification (5 Steps)

1. **Step 1 — Account Creation:**
   - Fields: Full Name, Email, Mobile, Password, Terms.
   - API: `POST /auth/register` (Role: `FOUNDER`).
2. **Step 2 — Startup Details:**
   - Fields: Startup Name, Description, Industry, Startup Stage.
   - API: `PATCH /auth/onboarding/draft`.
3. **Step 3 — Founder Profile:**
   - Fields: Designation, Country, City, optional LinkedIn URL.
4. **Step 4 — Startup Goals:**
   - Sourced from live 39-item `startup_goal` master option catalog via multi-select chip sheet.
5. **Step 5 — Completion:**
   - Dashboard redirect to `/dashboard/founder`.
