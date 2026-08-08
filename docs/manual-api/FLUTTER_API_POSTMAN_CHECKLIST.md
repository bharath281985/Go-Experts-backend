# Go Experts — Flutter API Postman Verification Checklist

Use this checklist to manually test and verify each implemented Flutter API in Postman or cURL.

| No | Role | Module | Method | Endpoint | Requires Login | Test User Role | Expected Status | Actual Status | PASS/FAIL | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Public | Auth | POST | `/auth/register` | NO | Any | 200 / 201 | 200 OK | **PASS** | Creates User & returns JWT |
| 2 | Public | Auth | POST | `/auth/login` | NO | Admin / Portal | 200 OK | 200 OK | **PASS** | Validates credentials & issues token |
| 3 | Auth | Onboarding | PATCH | `/auth/onboarding/draft` | YES | Any | 200 OK | 200 OK | **PASS** | Saves progressive step draft |
| 4 | Public | Masters | GET | `/v1/mobile/public/skills` | NO | Any | 200 OK | 200 OK | **PASS** | Returns paginated 1,815 skills |
| 5 | Public | Masters | GET | `/v1/mobile/public/industries` | NO | Any | 200 OK | 200 OK | **PASS** | Returns 134 industries |
| 6 | Public | Masters | GET | `/public/masters` | NO | Any | 200 OK | 200 OK | **PASS** | Returns designated master types |
| 7 | Freelancer| Dashboard| GET | `/freelancer/dashboard` | YES | Freelancer | 200 OK | 200 OK | **PASS** | Returns freelancer stats |
| 8 | Freelancer| Profile | GET | `/freelancer/profile` | YES | Freelancer | 200 OK | 200 OK | **PASS** | Returns profile details |
| 9 | Client | Dashboard| GET | `/client/dashboard` | YES | Client | 200 OK | 200 OK | **PASS** | Returns client project summary |
| 10 | Client | Projects | POST | `/client/projects` | YES | Client | 200 OK | 200 OK | **PASS** | Creates project post |
| 11 | Investor | Dashboard| GET | `/investor/dashboard` | YES | Investor | 200 OK | 200 OK | **PASS** | Returns investment watchlist |
| 12 | Founder | Startup | GET | `/founder/startup` | YES | Founder | 200 OK | 200 OK | **PASS** | Returns startup venture details |
