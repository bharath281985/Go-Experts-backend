# Flutter Master API Mapping Report

This report documents how all Flutter mobile dropdowns, selectors, and search sheets consume live backend master endpoints.

| Mobile Dropdown / Selector | Backend Master Endpoint | DB Source Table | Search & Debounce |
|---|---|---|---|
| **Skills (3 min, 10 max)** | `GET /v1/mobile/public/skills` | `skills` (1,815 items) | `?search=...&limit=30` (250ms debounce) |
| **Technologies** | `GET /public/masters?type=technology` | `master_options` (708 items) | `?search=...` (250ms debounce) |
| **Industries** | `GET /v1/mobile/public/industries` | `industries` (134 items) | Searchable Bottom Sheet |
| **Designations** | `GET /public/masters?type=designation` | `master_options` (165 items) | Searchable Bottom Sheet |
| **Countries** | `GET /public/countries` | `countries` (13 items) | Instant Select |
| **India States & UTs** | `GET /public/masters?type=state` | `master_options` (36 items) | Searchable Sheet |
| **India Cities** | `GET /public/masters?type=city` | `master_options` (105 items) | Searchable Sheet |
| **Startup Goals** | `GET /public/masters?type=startup_goal` | `master_options` (39 items) | Multi-select Chip Sheet |

Zero hardcoded mobile master arrays are used.
