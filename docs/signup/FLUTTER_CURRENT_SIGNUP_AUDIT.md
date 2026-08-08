# Flutter Current Signup Audit Report — Phase 3.1

## Executive Overview
This audit evaluates the current mobile architecture and contracts for the **Go Experts Flutter Application** prior to implementing the Image 1 mobile signup redesign and live API integration.

---

## 1. Audit Findings Matrix

| Component | Current Implementation | Target Phase 3 Architecture | Gap / Action Item |
|---|---|---|---|
| **Role Selection** | Basic radio / button selector | Image 1 4-role selection cards (Freelancer, Client, Investor, Founder) | **UPGRADE** to Image 1 Card Grid |
| **Auth Architecture** | `AuthBloc` / `AuthRepository` | Shared `AuthBloc` with secure session management (`flutter_secure_storage`) | **REUSE & HARDEN** session storage |
| **Backend API Contract** | Legacy / Mobile specific endpoints | Reused production endpoints (`POST /auth/register`, `PATCH /auth/onboarding/draft`) | **ALIGN** 100% with Website contracts |
| **Master Data Retrieval** | Hardcoded options / static maps | Live Master APIs (`/v1/mobile/public/skills`, `/v1/mobile/public/industries`, `/public/masters`) | **REPLACE** static maps with live Master APIs |
| **Skills & Technologies Component** | Full catalog fetch | Searchable bottom sheet with 250–300ms API debounce | **IMPLEMENT** debounced search sheet |
| **Progressive Onboarding** | Single submission | Step 1 Token issuance $\rightarrow$ Steps 2–5 Progressive draft saving | **IMPLEMENT** step-by-step draft save |
| **Token Storage** | `SharedPreferences` | `flutter_secure_storage` | **MIGRATE** to encrypted secure storage |
| **Navigation & Redirects** | Legacy routes | Dashboard routes (`/dashboard/freelancer`, `/dashboard/client`, `/dashboard/investor`, `/dashboard/founder`) | **PRESERVE** existing dashboard routes |

---

## 2. Reused Backend Contracts (Zero Duplicate APIs)

- `POST /auth/register` (Step 1 Account Creation $\rightarrow$ Issues JWT Access Token)
- `PATCH /auth/onboarding/draft` (Steps 2–4 Progressive Draft Saving)
- `GET /v1/mobile/public/skills?search=...&limit=30` (Searchable 1,815 Skills)
- `GET /v1/mobile/public/industries` (134 Industries)
- `GET /public/countries` (13 Countries)
- `GET /public/masters?type=...` (Designations, Company Sizes, Experience Levels, Startup Stages, Investor Types, Startup Goals)

---

## 3. UI Component Blueprint (Image 1 Mobile Design Reference)

- **`SignupScaffold`**: Top header with step progress indicator, red Go Experts accent bar, and sticky bottom `Back` / `Continue` buttons.
- **`SignupSearchDropdown`**: Searchable modal bottom sheet for Industries, Designations, States, and Cities.
- **`SignupMultiSelectSheet`**: Searchable chip selection bottom sheet for Skills (3 min, 10 max) and Startup Goals.
- **`SignupSuccessView`**: Lottie/Icon completion screen with role-specific dashboard redirect.
