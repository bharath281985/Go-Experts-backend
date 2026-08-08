# Signup Master Validation & Integration Report

This report confirms how the four website signup flows fetch and utilize the newly seeded master data via public API endpoints.

## Signup Flow API Endpoint Mapping

| Signup Flow | Form Dropdown / Selector | Public API Endpoint | Underlying Database Table | Status |
|---|---|---|---|---|
| **Freelancer** | Country | `GET /api/public/countries` | `countries` | **ACTIVE** |
| **Freelancer** | Primary Industry / Domain | `GET /api/public/industries` | `industries` | **ACTIVE** |
| **Freelancer** | Key Skills | `GET /api/v1/mobile/public/skills` | `skills` | **ACTIVE** |
| **Freelancer** | Experience Level | `GET /api/public/masters?type=experience_level` | `master_options` | **ACTIVE** |
| **Client** | Work Country / City | `GET /api/public/countries` | `countries` | **ACTIVE** |
| **Client** | Industry / Sector | `GET /api/public/industries` | `industries` | **ACTIVE** |
| **Client** | Company Size | `GET /api/public/masters?type=company_size` | `master_options` | **ACTIVE** |
| **Client** | Job Title / Position | `GET /api/public/masters?type=designation` | `master_options` | **ACTIVE** |
| **Investor** | Country / City | `GET /api/public/countries` | `countries` | **ACTIVE** |
| **Investor** | Investor Type | `GET /api/public/masters?type=investor_type` | `master_options` | **ACTIVE** |
| **Investor** | Focus Sectors | `GET /api/public/industries` | `industries` | **ACTIVE** |
| **Investor** | Preferred Investment Stage | `GET /api/public/masters?type=startup_stage` | `master_options` | **ACTIVE** |
| **Investor** | Min/Max Check Size | `GET /api/public/masters?type=ticket_size` | `master_options` | **ACTIVE** |
| **Founder** | Country / City | `GET /api/public/countries` | `countries` | **ACTIVE** |
| **Founder** | Startup Industry | `GET /api/public/industries` | `industries` | **ACTIVE** |
| **Founder** | Current Startup Stage | `GET /api/public/masters?type=startup_stage` | `master_options` | **ACTIVE** |
| **Founder** | Role in Startup | `GET /api/public/masters?type=designation` | `master_options` | **ACTIVE** |
| **Founder** | Primary Goal | `GET /api/public/masters?type=startup_goal` | `master_options` | **ACTIVE** |

No signup dropdown uses hardcoded inline arrays if a master endpoint exists.
