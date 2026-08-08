# Flutter Social Signup & Role Preservation Report

## Social Authentication Workflow

1. **Role Pre-Selection:**
   - User selects role on mobile role selection screen (Freelancer, Client, Investor, or Founder).
2. **Provider Sign-In:**
   - User authenticates via Google (`google_sign_in`) or Apple (`sign_in_with_apple`).
3. **Backend Registration:**
   - App passes `idToken` and selected `role` to backend social auth endpoint.
   - Backend creates `User` with explicit selected role (never defaults to `FREELANCER`).
4. **JWT Session Issue:**
   - Backend issues JWT `accessToken` and `refreshToken`.
   - App securely saves tokens in `flutter_secure_storage`.
5. **Progressive Onboarding Hand-Off:**
   - App advances user to Step 2 (Profile Details) of their selected role flow.
