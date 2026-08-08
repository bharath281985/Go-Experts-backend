# Flutter Signup End-to-End Persistence Report — Phase 3B

## Database Persistence & API Integration Matrix

| Role | Step 1 Token API | Step 2–4 Progressive Draft API | Target Database Tables | Relational Persistence | Relogin Test |
|---|---|---|---|---|---|
| **Freelancer** | `POST /auth/register` | `PATCH /auth/onboarding/draft` | `User`, `FreelancerProfile`, `FreelancerSkill` | Composite unique `[freelancerId, skillId]` | **PASS** |
| **Client** | `POST /auth/register` | `PATCH /auth/onboarding/draft` | `User`, `ClientProfile` | Master IDs for Industry, Size, & Designation | **PASS** |
| **Investor** | `POST /auth/register` | `PATCH /auth/onboarding/draft` | `User`, `InvestorProfile`, `InvestorPreferredIndustry` | Multi-select preferred industries | **PASS** |
| **Founder** | `POST /auth/register` | `PATCH /auth/onboarding/draft` | `User`, `FounderProfile` | 39-item Startup Goal master mapping | **PASS** |

## Social Authentication & Role Preservation
- **Google Sign-In (`google_sign_in`):** Selected role preserved; hands off cleanly to Step 2 of selected role flow.
- **Apple Sign-In (`sign_in_with_apple`):** Selected role preserved.
- **LinkedIn:** Displays safe "Coming Soon" prompt.
- **Defaulting to Freelancer:** **NONE** (0 instances).
