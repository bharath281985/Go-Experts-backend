# Flutter Mobile Signup Test & Verification Report

This report documents test cases executed for the Flutter mobile signup system.

## Mobile Test Suite Matrix

| Test Case | Inputs / Condition | Expected Behavior | Result |
|---|---|---|---|
| **Email Pre-existence** | Existing email on Step 1 | Inline error: "Email is already registered. Please login." | **PASS** |
| **Invalid Email Format** | `test@` | Inline error: "Please enter a valid email address" | **PASS** |
| **Password Strength** | `< 8 chars` | Inline error: "Password must be at least 8 characters" | **PASS** |
| **Skill Min Selection** | 2 skills selected | Continue disabled / Toast: "Please select at least 3 skills" | **PASS** |
| **Skill Max Selection** | 11th skill tapped | Toast: "Maximum 10 skills allowed" | **PASS** |
| **Network Loss / Offline** | Flight mode toggled mid-signup | Form data preserved; Retry bar shown without clearing fields | **PASS** |
| **Token Expiry** | Expired access token | Refreshes token automatically; falls back cleanly to login | **PASS** |
| **Social Role Preservation** | Google Sign-in on Founder card | User role created as `FOUNDER`; advances to Founder Step 2 | **PASS** |
| **Dashboard Redirect** | Signup completion | Navigates to exact role dashboard route without defaulting | **PASS** |
