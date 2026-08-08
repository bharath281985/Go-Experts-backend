# Flutter Freelancer Mobile Signup Report

## Step-by-Step Flow Specification (5 Steps)

1. **Step 1 — Account Creation:**
   - Fields: Full Name, Email, Mobile Number, Password, Terms & Privacy checkbox.
   - API: `POST /auth/register` (Role: `FREELANCER`). Stores access token securely via `flutter_secure_storage`.
2. **Step 2 — Profile Details:**
   - Fields: Professional Headline, Country, City, Bio, optional Profile Photo.
   - API: `PATCH /auth/onboarding/draft`.
3. **Step 3 — Skills Selection:**
   - Searchable bottom sheet querying `/v1/mobile/public/skills?search=...&limit=30` with 250ms debounce.
   - Rules: Minimum 3, maximum 10 skills. Displayed as removable chips.
4. **Step 4 — Experience:**
   - Sourced from Master API (`experience_level`, `experience_range`).
5. **Step 5 — Completion & Dashboard Redirect:**
   - Success screen with redirect to `/dashboard/freelancer`.
