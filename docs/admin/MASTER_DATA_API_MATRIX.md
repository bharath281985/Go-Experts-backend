# Master Data API Matrix

| Master Taxonomy | Super Admin REST Route | HTTP Method | Query Parameters | Response Structure | Status |
|---|---|---|---|---|---|
| **Skills** | `/admin/skills` | `GET`, `POST`, `PUT`, `DELETE` | `page=1&pageSize=50&search=react` | `{ success: true, data: [...], meta: {...} }` | **CONNECTED** |
| **Industries** | `/admin/industries` | `GET`, `POST`, `PUT`, `DELETE` | `page=1&pageSize=50` | `{ success: true, data: [...], meta: {...} }` | **CONNECTED** |
| **Categories** | `/admin/categories` | `GET`, `POST`, `PUT`, `DELETE` | `page=1&pageSize=50` | `{ success: true, data: [...], meta: {...} }` | **CONNECTED** |
| **Countries** | `/admin/countries` | `GET`, `POST`, `PUT`, `DELETE` | `page=1&pageSize=50` | `{ success: true, data: [...], meta: {...} }` | **CONNECTED** |
| **Currencies** | `/admin/currencies` | `GET`, `POST`, `PUT`, `DELETE` | `page=1&pageSize=50` | `{ success: true, data: [...], meta: {...} }` | **CONNECTED** |
| **Languages** | `/admin/languages` | `GET`, `POST`, `PUT`, `DELETE` | `page=1&pageSize=50` | `{ success: true, data: [...], meta: {...} }` | **CONNECTED** |
| **Pricing Plans** | `/admin/pricing_plans` | `GET`, `POST`, `PUT`, `DELETE` | `page=1&pageSize=50` | `{ success: true, data: [...], meta: {...} }` | **CONNECTED** |
| **Master Options** | `/admin/master_options` | `GET`, `POST`, `PUT`, `DELETE` | `page=1&pageSize=50&filters={"type":"designation"}` | `{ success: true, data: [...], meta: {...} }` | **CONNECTED** |
