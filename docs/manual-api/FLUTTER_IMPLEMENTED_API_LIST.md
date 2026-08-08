# Go Experts — Flutter Implemented API List for Manual Verification

## Base System Configuration
- **Production Base URL:** `https://apiai.goexperts.in/api/v1/mobile`
- **Local Dev Base URL:** `http://localhost:3000/api`
- **Realtime Socket URL:** `https://apiai.goexperts.in` (Socket.IO)

---

## Group A: Authentication & Public APIs

### API ID: AUTH-01
- **Role:** Public / All Roles
- **Module:** Authentication
- **Screen:** `SignupPage`
- **Method:** `POST`
- **Endpoint:** `/auth/register`
- **Full URL:** `http://localhost:3000/api/auth/register`
- **Auth Required:** NO
- **Request Body:** `{ "fullName": "String", "email": "String", "password": "String", "role": "freelancer" | "client" | "investor" | "founder" }`
- **Backend Route:** `/auth/register`
- **Backend Controller:** `auth.controller.ts`
- **DB Model:** `User`
- **Status:** `CONNECTED`
- **Manual Test Ready:** YES

### API ID: AUTH-02
- **Role:** Public / All Roles
- **Module:** Authentication
- **Screen:** `LoginPage`
- **Method:** `POST`
- **Endpoint:** `/auth/login`
- **Full URL:** `http://localhost:3000/api/auth/login`
- **Auth Required:** NO
- **Request Body:** `{ "email": "admin@goexperts.in", "password": "Admin@12345" }`
- **Backend Route:** `/auth/login`
- **Backend Controller:** `auth.controller.ts`
- **DB Model:** `AdminUser` / `User`
- **Status:** `CONNECTED`
- **Manual Test Ready:** YES

### API ID: AUTH-03
- **Role:** Authenticated User
- **Module:** Authentication
- **Screen:** `SignupPage` (Steps 2–4)
- **Method:** `PATCH`
- **Endpoint:** `/auth/onboarding/draft`
- **Full URL:** `http://localhost:3000/api/auth/onboarding/draft`
- **Auth Required:** YES (Bearer Token)
- **Request Body:** Progressive onboarding payload per step
- **Backend Route:** `/auth/onboarding/draft`
- **Backend Controller:** `auth.controller.ts`
- **DB Model:** `User` / Role Profiles
- **Status:** `CONNECTED`
- **Manual Test Ready:** YES

### API ID: AUTH-04
- **Role:** Authenticated User
- **Module:** Authentication
- **Screen:** `SplashPage` / App Restore
- **Method:** `POST`
- **Endpoint:** `/auth/refresh`
- **Full URL:** `http://localhost:3000/api/auth/refresh`
- **Auth Required:** YES (Refresh Token)
- **Request Body:** `{ "refreshToken": "String" }`
- **Backend Route:** `/auth/refresh`
- **Backend Controller:** `auth.controller.ts`
- **DB Model:** `RefreshToken`
- **Status:** `CONNECTED`
- **Manual Test Ready:** YES

---

## Group B: Freelancer APIs

### API ID: FREE-01
- **Role:** Freelancer
- **Module:** Dashboard
- **Screen:** `FreelancerHomePage`
- **Method:** `GET`
- **Endpoint:** `/freelancer/dashboard`
- **Full URL:** `http://localhost:3000/api/freelancer/dashboard`
- **Auth Required:** YES (Freelancer Token)
- **Backend Route:** `/freelancer/dashboard`
- **Backend Controller:** `freelancer.controller.ts`
- **DB Model:** `FreelancerProfile`, `Proposal`, `Task`
- **Status:** `CONNECTED`
- **Manual Test Ready:** YES

### API ID: FREE-02
- **Role:** Freelancer
- **Module:** Profile
- **Screen:** `FreelancerEditProfilePage`
- **Method:** `GET`
- **Endpoint:** `/freelancer/profile`
- **Full URL:** `http://localhost:3000/api/freelancer/profile`
- **Auth Required:** YES (Freelancer Token)
- **Backend Route:** `/freelancer/profile`
- **Backend Controller:** `freelancer.controller.ts`
- **DB Model:** `FreelancerProfile`
- **Status:** `CONNECTED`
- **Manual Test Ready:** YES

### API ID: FREE-03
- **Role:** Freelancer
- **Module:** Profile Edit
- **Screen:** `FreelancerEditProfilePage`
- **Method:** `PATCH`
- **Endpoint:** `/freelancer/profile`
- **Full URL:** `http://localhost:3000/api/freelancer/profile`
- **Auth Required:** YES (Freelancer Token)
- **Request Body:** `{ "titleHeadline": "Senior Engineer", "bio": "Expert in Flutter & Node.js" }`
- **Backend Route:** `/freelancer/profile`
- **Backend Controller:** `freelancer.controller.ts`
- **DB Model:** `FreelancerProfile`
- **Status:** `CONNECTED`
- **Manual Test Ready:** YES

---

## Group C: Client / Business Owner APIs

### API ID: CLI-01
- **Role:** Client
- **Module:** Dashboard
- **Screen:** `ClientHomePage`
- **Method:** `GET`
- **Endpoint:** `/client/dashboard`
- **Full URL:** `http://localhost:3000/api/client/dashboard`
- **Auth Required:** YES (Client Token)
- **Backend Route:** `/client/dashboard`
- **Backend Controller:** `client.controller.ts`
- **DB Model:** `ClientProfile`, `Project`, `Proposal`
- **Status:** `CONNECTED`
- **Manual Test Ready:** YES

### API ID: CLI-02
- **Role:** Client
- **Module:** Projects
- **Screen:** `CreateProjectPage`
- **Method:** `POST`
- **Endpoint:** `/client/projects`
- **Full URL:** `http://localhost:3000/api/client/projects`
- **Auth Required:** YES (Client Token)
- **Request Body:** `{ "title": "Build Mobile App", "budget": 50000, "category": "Mobile Dev" }`
- **Backend Route:** `/client/projects`
- **Backend Controller:** `project.controller.ts`
- **DB Model:** `Project`
- **Status:** `CONNECTED`
- **Manual Test Ready:** YES

---

## Group D: Investor APIs

### API ID: INV-01
- **Role:** Investor
- **Module:** Dashboard
- **Screen:** `InvestorHomePage`
- **Method:** `GET`
- **Endpoint:** `/investor/dashboard`
- **Full URL:** `http://localhost:3000/api/investor/dashboard`
- **Auth Required:** YES (Investor Token)
- **Backend Route:** `/investor/dashboard`
- **Backend Controller:** `investor.controller.ts`
- **DB Model:** `InvestorProfile`, `Watchlist`
- **Status:** `CONNECTED`
- **Manual Test Ready:** YES

---

## Group E: Founder APIs

### API ID: FND-01
- **Role:** Founder
- **Module:** Startup Profile
- **Screen:** `MyStartupView`
- **Method:** `GET`
- **Endpoint:** `/founder/startup`
- **Full URL:** `http://localhost:3000/api/founder/startup`
- **Auth Required:** YES (Founder Token)
- **Backend Route:** `/founder/startup`
- **Backend Controller:** `founder.controller.ts`
- **DB Model:** `FounderProfile`
- **Status:** `CONNECTED`
- **Manual Test Ready:** YES

---

## Group K: Master Data APIs

### API ID: MST-01
- **Role:** Public / All Roles
- **Module:** Master Data
- **Screen:** `SignupPage` / Dropdowns
- **Method:** `GET`
- **Endpoint:** `/v1/mobile/public/skills`
- **Full URL:** `http://localhost:3000/api/v1/mobile/public/skills?search=react&limit=30`
- **Auth Required:** NO
- **Query Params:** `search=react&limit=30`
- **Status:** `CONNECTED`
- **Manual Test Ready:** YES

### API ID: MST-02
- **Role:** Public / All Roles
- **Module:** Master Data
- **Screen:** `SignupPage` / Dropdowns
- **Method:** `GET`
- **Endpoint:** `/v1/mobile/public/industries`
- **Full URL:** `http://localhost:3000/api/v1/mobile/public/industries`
- **Auth Required:** NO
- **Status:** `CONNECTED`
- **Manual Test Ready:** YES

### API ID: MST-03
- **Role:** Public / All Roles
- **Module:** Master Data
- **Screen:** `SignupPage` / Dropdowns
- **Method:** `GET`
- **Endpoint:** `/public/masters`
- **Full URL:** `http://localhost:3000/api/public/masters?type=designation`
- **Auth Required:** NO
- **Query Params:** `type=designation`
- **Status:** `CONNECTED`
- **Manual Test Ready:** YES
