# Master Data API Matrix

| API Endpoint | HTTP Method | Auth Required | Purpose | Controller | Status |
|---|---|---|---|---|---|
| `/api/admin/:table` | `GET` | YES (Admin) | List master records | `index.ts` | **CONNECTED** |
| `/api/admin/:table` | `POST` | YES (Admin) | Create master record | `index.ts` | **CONNECTED** |
| `/api/admin/:table/:id` | `PUT` | YES (Admin) | Update master record | `index.ts` | **CONNECTED** |
| `/api/admin/:table/:id` | `DELETE` | YES (Admin) | Delete master record | `index.ts` | **CONNECTED** |
| `/api/admin/:table/bulk-delete` | `POST` | YES (Admin) | Bulk delete records | `index.ts` | **CONNECTED** |
| `/api/admin/:table/bulk-status` | `POST` | YES (Admin) | Bulk activate/deactivate | `index.ts` | **CONNECTED** |
| `/api/v1/mobile/public/skills` | `GET` | NO | Mobile / Web public skills | `catalog.controller.ts` | **CONNECTED** |
| `/api/v1/mobile/public/industries` | `GET` | NO | Mobile / Web public industries | `catalog.controller.ts` | **CONNECTED** |
| `/api/public/masters` | `GET` | NO | Mobile / Web public master options | `catalog.controller.ts` | **CONNECTED** |
