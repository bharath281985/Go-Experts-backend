# Investor Master Data Persistence Report

## Step-by-Step Validation (4 Steps)

1. **Step 1 — Account:**
   - Captures credentials, creates `User` with role `INVESTOR`.
2. **Step 2 — Investor Profile:**
   - Captures `designation`, `country`, `city`, `firm`.
3. **Step 3 — Investment Preferences:**
   - Multi-select `focusAreas` (Industries), `preferredStage`, `ticketMin`, `ticketMax`.
   - Industries sourced from `/v1/mobile/public/industries`.
4. **Step 4 — Complete:**
   - Role redirected to `/dashboard/investor`.

## Relational Persistence Results
- **Database Tables:** `User`, `InvestorProfile`, `InvestorPreferredIndustry`.
- **Multi-select Relations:** Safely creates relational records without duplication.
- **Edit Profile Test:** Prefills investment ticket ranges and stage preferences.
