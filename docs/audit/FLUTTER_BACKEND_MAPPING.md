# Flutter ↔ Backend Endpoint Mapping Report

This document traces the exact chain from Flutter UI widgets to backend controllers and Prisma database models.

| Flutter Feature | Flutter Method | Endpoint Path | Backend Route | Backend Controller | Prisma Model | Status |
|---|---|---|---|---|---|---|
| **Register (Step 1)** | `SignupRequested` | `POST /auth/register` | `/auth/register` | `auth.controller.ts` | `User` | **CONNECTED** |
| **Draft Onboarding** | `updateDraft` | `PATCH /auth/onboarding/draft` | `/auth/onboarding/draft` | `auth.controller.ts` | `User` / Profiles | **CONNECTED** |
| **Login** | `LoginRequested` | `POST /auth/login` | `/auth/login` | `auth.controller.ts` | `AdminUser` / `User` | **CONNECTED** |
| **Token Refresh** | `refreshToken` | `POST /auth/refresh` | `/auth/refresh` | `auth.controller.ts` | `RefreshToken` | **CONNECTED** |
| **Skills Catalog** | `fetchSkills` | `GET /v1/mobile/public/skills` | `/v1/mobile/public/skills` | `catalog.controller.ts` | `Skill` | **CONNECTED** |
| **Industries Catalog** | `fetchIndustries` | `GET /v1/mobile/public/industries` | `/v1/mobile/public/industries` | `catalog.controller.ts` | `Industry` | **CONNECTED** |
| **Master Options** | `fetchMasters` | `GET /public/masters` | `/public/masters` | `catalog.controller.ts` | `MasterOption` | **CONNECTED** |
| **Freelancer Profile** | `getProfile` | `GET /freelancer/profile` | `/freelancer/profile` | `freelancer.controller.ts` | `FreelancerProfile` | **CONNECTED** |
| **Update Freelancer** | `updateProfile` | `PATCH /freelancer/profile` | `/freelancer/profile` | `freelancer.controller.ts` | `FreelancerProfile` | **CONNECTED** |
| **Client Profile** | `getClientProfile` | `GET /client/profile` | `/client/profile` | `client.controller.ts` | `ClientProfile` | **CONNECTED** |
| **Create Project** | `createProject` | `POST /client/projects` | `/client/projects` | `project.controller.ts` | `Project` | **CONNECTED** |
| **Investor Profile** | `getInvestorProfile` | `GET /investor/profile` | `/investor/profile` | `investor.controller.ts` | `InvestorProfile` | **CONNECTED** |
| **Founder Startup** | `getStartup` | `GET /founder/startup` | `/founder/startup` | `founder.controller.ts` | `FounderProfile` | **CONNECTED** |
