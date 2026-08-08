# Flutter Client / Business Owner Mobile Signup Report

## Step-by-Step Flow Specification (5 Steps)

1. **Step 1 — Account Creation:**
   - Fields: Full Name, Email, Mobile, Password, Terms.
   - API: `POST /auth/register` (Role: `CLIENT`). Token saved to `flutter_secure_storage`.
2. **Step 2 — Business Details:**
   - Fields: Business Name, Industry (from `/v1/mobile/public/industries`), Company Size, Country, City.
   - API: `PATCH /auth/onboarding/draft`.
3. **Step 3 — Profile & Designation:**
   - Fields: Designation (from 165 Designations master list), optional photo/work phone.
4. **Step 4 — Team Invitation (Optional):**
   - Allows entering team emails or tapping "Skip for Now".
5. **Step 5 — Completion:**
   - Dashboard redirect to `/dashboard/client`.
