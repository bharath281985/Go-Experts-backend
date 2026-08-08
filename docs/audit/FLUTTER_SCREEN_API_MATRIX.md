# Flutter Screen ↔ API Matrix

This report evaluates every screen in `lib/features/` to verify its data binding and backend connection status.

## Screen Matrix

| Feature Module | Screen Name | State Management | Primary API Endpoint | Connection Status |
|---|---|---|---|---|
| **Auth** | `SplashPage` | `AuthBloc` | `GET /auth/me` | **CONNECTED** |
| **Auth** | `LoginPage` | `AuthBloc` | `POST /auth/login` | **CONNECTED** |
| **Auth** | `SignupPage` | `AuthBloc` | `POST /auth/register` | **CONNECTED** |
| **Auth** | `ForgotPasswordPage` | `AuthBloc` | `POST /auth/forgot-password` | **CONNECTED** |
| **Freelancer** | `FreelancerHomePage` | `FreelancerBloc` | `GET /freelancer/dashboard` | **CONNECTED** |
| **Freelancer** | `FreelancerEditProfilePage` | `FreelancerProfileCubit` | `PATCH /freelancer/profile` | **CONNECTED** |
| **Freelancer** | `FreelancerVerificationPage` | `CredentialsCubit` | `POST /freelancer/profile/kyc` | **CONNECTED** |
| **Client** | `ClientHomePage` | `ClientBloc` | `GET /client/dashboard` | **CONNECTED** |
| **Client** | `CreateProjectPage` | `ProjectCubit` | `POST /client/projects` | **CONNECTED** |
| **Investor** | `InvestorHomePage` | `InvestorBloc` | `GET /investor/dashboard` | **CONNECTED** |
| **Investor** | `InvestorSubpages` | `InvestorBloc` | `GET /investor/startups` | **CONNECTED** |
| **Founder** | `FounderHomePage` | `FounderBloc` | `GET /founder/dashboard` | **CONNECTED** |
| **Founder** | `MyStartupView` | `FounderBloc` | `GET /founder/startup` | **CONNECTED** |
| **Messages** | `ChatPage` | `ChatCubit` | `GET /chat/conversations/:id` + Socket.IO | **CONNECTED** |
| **Wallet** | `WalletPage` | `WalletCubit` | `GET /wallet/transactions` | **CONNECTED** |
| **Settings** | `SettingsPage` | `SettingsCubit` | `GET /auth/me` | **CONNECTED** |
