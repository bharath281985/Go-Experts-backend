# Flutter Investor Mobile Signup Report

## Step-by-Step Flow Specification (4 Steps)

1. **Step 1 — Account Creation:**
   - Fields: Full Name, Email, Mobile, Password, Terms.
   - API: `POST /auth/register` (Role: `INVESTOR`).
2. **Step 2 — Investor Profile:**
   - Fields: Designation, Country, City, optional Firm/Organization.
   - API: `PATCH /auth/onboarding/draft`.
3. **Step 3 — Investment Preferences:**
   - Fields: Preferred Industries (multi-select bottom sheet), Investment Stage, Investment Range (Ticket Size).
4. **Step 4 — Completion:**
   - Dashboard redirect to `/dashboard/investor`.
