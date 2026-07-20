# Go Experts Master Database Seeding Report

This report summarizes the schema, records populated, credentials, and configuration metrics in the generated Go Experts complete database seed.

## 🔑 Administrative Credentials

The database contains default roles and administrative users pre-configured with secure credentials.

| Email | Full Name | Default Role | Password | Status |
|---|---|---|---|---|
| `admin@goexperts.in` | System Super Admin | **Super Admin** (Full Access) | `Admin@12345` | Active |
| `admin@goexperts.com` | General Admin | **Admin** (Standard Access) | `Admin@12345` | Active |
| `content@goexperts.in` | CMS Content Manager | **Content Manager** | `Admin@12345` | Active |
| `support@goexperts.in` | Customer Support Executive | **Support Executive** | `Admin@12345` | Active |
| `finance@goexperts.in` | Lead Finance Manager | **Finance Manager** | `Admin@12345` | Active |
| `marketing@goexperts.in` | Growth Marketing Manager | **Marketing Manager** | `Admin@12345` | Active |

---

## 📊 Database Record Summary

The master seed script has populated all relational tables with high-fidelity, production-ready demo data matching the following volumes:

### 1. Identity & Profile Layer
- **users**: `400` platform users
  - `100` Freelancers (with active `freelancer_profiles`)
  - `100` Clients (with active `client_profiles`)
  - `100` Investors (with active `investor_profiles`)
  - `100` Founders (with active `founder_profiles`)
- **admin_users**: `6` administrative users
- **roles**: `6` administrative roles
- **permissions**: `100` module permissions
- **role_permissions**: `181` mapped permission matrices

### 2. Work & Engagement Module
- **projects**: `100` project listings across 6 categories (Web, Mobile, AI/ML, UI/UX, Content, Audit)
- **proposals**: `300` bids submitted by freelancers
- **contracts**: `9` active agreements
- **milestones**: `27` associated project delivery milestones
- **tasks**: `200` project tasks
- **task_checklists**: `594` actionable checklist steps
- **task_comments**: `200` comments
- **task_attachments**: `200` attachments
- **time_logs**: `200` hourly work entries
- **reviews**: `100` peer rating reviews (Freelancer ⇄ Client)

### 3. Startup & Investment Module
- **startup_ideas**: `100` startup ideas connected to Founders
- **investments**: `100` investment offers/deals mapped to Investors
- **meetings**: `50` scheduled founder-investor pitch slots
- **conversations**: `50` messaging threads
- **messages**: `100` chat interactions

### 4. Financial Layer
- **subscription_plans**: `10` subscription tiers for all 4 roles
- **subscriptions**: `200` user subscription assignments (140 Active, 60 Expired)
- **subscription_usage**: `500` quota track records
- **payments**: `100` Gateway payments (Completed, Pending, Failed)
- **payment_refunds**: `50` processed customer refund transactions
- **invoices**: `100` generated invoices
- **invoice_items**: `100` tax/fee line items
- **wallets**: `400` balance storage nodes (one per user)
- **wallet_transactions**: `300` wallet credits/debits
- **coupons**: `50` active coupon codes
- **coupon_usage**: `50` coupon application records

### 5. Omnichannel Notification Engine
- **notification_templates**: `3` pre-formatted system response scripts
- **communication_channels**: `5` configured delivery providers (Email, SMS, WhatsApp, Push, In-App)
- **notification_preferences**: `50` user toggle profiles (defended schema fields)
- **notifications**: `100` triggered system notification entries
- **notification_logs**: `100` dispatch receipts

### 6. Support System
- **support_tickets**: `100` customer support logs (Open, Resolved, Closed)

### 7. Telemetry, DevOps & API Monitoring
- **api_request_logs**: `1000` HTTP request diagnostics logs
- **api_usage_logs**: `500` developer usage entries
- **api_keys**: `5` mock integration secrets
- **api_versions**: `2` API version trackers (`v1` deprecated, `v2` active)
- **api_changelog**: `3` developer release logs
- **webhooks**: `1` active outgoing notification webhook
- **webhook_events**: `3` webhook action bindings
- **webhook_deliveries**: `45` delivery logs
- **login_attempts**: `100` session tracking trials
- **system_alerts**: `20` alerts (Critical, Warning, Info)
- **scheduled_jobs**: `4` scheduler task plans
- **job_history**: `48` execution outputs
- **automation_rules**: `2` automated action definitions
- **automation_logs**: `50` event trigger reports
- **cron_executions**: `48` scheduler runner histories
- **backups**: `5` database snapshot indicators
- **audit_logs**: `30` security mutation receipts
- **activity_logs**: `30` general supervisor operations logs

---

## 🌎 India Geolocation Data

Freelancers, Startup Founders, and Clients are distributed across major Indian metropolitan cities and startup hubs:
- Bangalore, Hyderabad, Chennai, Mumbai, Delhi NCR, Pune, Kolkata, Ahmedabad, Jaipur, Lucknow, Kochi, Coimbatore, Vijayawada, Visakhapatnam, Kakinada, Rajahmundry, Tirupati, Guntur, and Warangal.

## 🛠 Testing Notes for Frontend & Mobile Integrations

1. **Authentication Testing**: Use `admin@goexperts.in` with password `Admin@12345` to log into the Super Admin panel.
2. **Data Presentation**: The frontend tables for Founders, Clients, and Freelancers contain diverse statuses (`active`, `suspended`, `inactive`) to verify safe parsing fallback implementations.
3. **Empty Data States**: Certain nullable relationships (e.g. `device_tokens`, `notification_queue`, `wallet_rewards`) are seeded empty to confirm that pages/widgets render clean fallback visuals instead of throwing layout crashes.
