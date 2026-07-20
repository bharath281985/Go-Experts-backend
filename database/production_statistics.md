# Go Experts Production Demo Database
## Seed Statistics & Record Counts

**Generated:** July 4, 2026  
**Database Engine:** SQLite (dev.db) → MySQL (production)  
**Seed Script:** `prisma/seed-production.ts`  
**SQL Dump:** `database/production_demo_seed.sql`  
**Total Lines in SQL Dump:** 56,988  
**SQL Dump Size:** ~10 MB  

---

## Total Record Count by Table

| # | Table | Records | Notes |
|---|-------|---------|-------|
| 1 | `roles` | 8 | Super Admin, Admin, Content, Support, Finance, Marketing, HR, Moderator |
| 2 | `permissions` | 100 | 10 modules × 10 actions |
| 3 | `role_permissions` | 200+ | Super Admin: all; Admin: non-destructive |
| 4 | `admin_users` | 36 | 1 Super Admin + 7 roles × 5 each |
| 5 | `users` | 1,600 | 500 FL + 500 CL + 300 FD + 300 INV |
| 6 | `freelancer_profiles` | 500 | Skills, hourly rate, experience, rating |
| 7 | `client_profiles` | 500 | Company, industry, total spend |
| 8 | `founder_profiles` | 300 | Startup name, stage, raised, team size |
| 9 | `investor_profiles` | 300 | Firm, ticket range, focus areas, deals |
| 10 | `wallets` | 1,600 | One wallet per user |
| 11 | `subscription_plans` | 10 | 4 FL + 3 CL + 2 INV + 1 FD |
| 12 | `subscriptions` | 900 | 500 active + 200 renewed + 100 expired + 100 trial |
| 13 | `subscription_history` | 900 | Purchase audit trail |
| 14 | `subscription_usage` | 1,800 | 2 feature usages per subscription |
| 15 | `subscription_transactions` | 900 | One transaction per subscription |
| 16 | `subscription_features` | 0 | Populated via plan limits JSON |
| 17 | `projects` | 500 | Across 18 categories |
| 18 | `milestones` | 1,500 | 3 per project |
| 19 | `proposals` | 1,500 | Pending, shortlisted, accepted, rejected |
| 20 | `contracts` | 500 | Active, completed, disputed, cancelled |
| 21 | `tasks` | 2,500 | Across all projects |
| 22 | `task_checklists` | 5,000 | 2 per task |
| 23 | `task_comments` | 2,000 | Freelancer comments per task |
| 24 | `task_attachments` | 1,000 | Design blueprints, specs |
| 25 | `time_logs` | 2,500 | 1 per task |
| 26 | `reviews` | 2,000 | Client → Freelancer reviews |
| 27 | `meetings` | 500 | Founder ↔ Investor meetings |
| 28 | `startup_ideas` | 500 | Across 14 startup categories |
| 29 | `investments` | 1,000 | Investor interest & deal tracking |
| 30 | `conversations` | 600 | 300 deal rooms + 300 support chats |
| 31 | `messages` | 3,000 | ~5 per conversation |
| 32 | `payments` | 1,000 | Across 6 gateways |
| 33 | `payment_refunds` | 100 | Partial refunds |
| 34 | `invoices` | 1,000 | One per payment |
| 35 | `invoice_items` | 1,000 | One line item per invoice |
| 36 | `wallet_transactions` | 1,500 | Credits and debits |
| 37 | `wallet_bonuses` | 200 | Promotional credits |
| 38 | `wallet_rewards` | 200 | Referral and milestone rewards |
| 39 | `coupons` | 100 | Active discount codes |
| 40 | `coupon_usage` | 200 | Redemption records |
| 41 | `referrals` | 80 | Unique referrer→referee pairs |
| 42 | `referral_rewards` | 80 | Reward per referral |
| 43 | `advertisement_plans` | 3 | Homepage, Sidebar, Category |
| 44 | `advertisements` | 30 | Active ad campaigns |
| 45 | `featured_services` | 50 | Featured freelancer/startup listings |
| 46 | `cms_pages` | 100 | 10 core + 90 SEO landing pages |
| 47 | `blogs` | 200 | Articles + success stories |
| 48 | `faqs` | 150 | Platform FAQs |
| 49 | `testimonials` | 100 | User testimonials |
| 50 | `email_templates` | 10 | System email templates |
| 51 | `campaigns` | 10 | Marketing campaigns |
| 52 | `media_files` | 500 | Images, videos, documents |
| 53 | `media_file_versions` | 500 | One version per file |
| 54 | `notification_templates` | 10 | Typed notification templates |
| 55 | `communication_channels` | 5 | Email, SMS, WhatsApp, Push, In-App |
| 56 | `notifications` | 2,000 | Multi-channel delivered notifications |
| 57 | `notification_logs` | 2,000 | Delivery audit log |
| 58 | `notification_preferences` | 1,600 | One per user |
| 59 | `notification_campaigns` | 10 | Broadcast notification campaigns |
| 60 | `device_tokens` | 400 | Mobile push tokens |
| 61 | `support_tickets` | 500 | Low/Med/High/Urgent priorities |
| 62 | `api_versions` | 2 | v1 (deprecated) + v2 (active) |
| 63 | `api_changelog` | 4 | Version release notes |
| 64 | `api_keys` | 10 | Developer API keys |
| 65 | `api_usage_logs` | 1,500 | Key-level usage tracking |
| 66 | `api_request_logs` | 3,000 | Full request/response audit |
| 67 | `webhooks` | 5 | External integration endpoints |
| 68 | `webhook_events` | 25 | 5 events per webhook |
| 69 | `webhook_deliveries` | 200 | Outbound delivery records |
| 70 | `login_attempts` | 500 | Success and failed logins |
| 71 | `system_alerts` | 100 | Operational alerts |
| 72 | `backups` | 24 | 24 daily snapshot records |
| 73 | `scheduled_jobs` | 4 | Platform cron workers |
| 74 | `job_history` | 500 | Execution records per job |
| 75 | `cron_executions` | 500 | Cron run history |
| 76 | `automation_rules` | 4 | Business automation rules |
| 77 | `automation_logs` | 500 | Rule trigger records |
| 78 | `audit_logs` | 500 | Admin action audit trail |
| 79 | `activity_logs` | 500 | Admin portal activity |
| 80 | `settings` | 25 | Platform configuration |
| 81 | `countries` | 10 | Reference data |
| 82 | `industries` | 15 | Reference data |
| 83 | `skills` | 25 | Reference data |
| 84 | `currencies` | 6 | Reference data |
| 85 | `languages` | 8 | Reference data |
| 86 | `startup_stages` | 7 | Reference data |
| 87 | `funding_types` | 8 | Reference data |
| 88 | `work_modes` | 5 | Reference data |
| 89 | `experience_levels` | 5 | Reference data |
| 90 | `notification_queue` | 0 | Runtime queue (populated by backend) |
| 91 | `notification_delivery_attempts` | 0 | Runtime queue attempts |
| 92 | `sessions` | 0 | Runtime session store |
| 93 | `refresh_tokens` | 0 | Runtime token store |

---

## Grand Total

| Category | Count |
|----------|-------|
| **Master data tables** | 89 records |
| **Admin users & permissions** | 336+ records |
| **Platform users + profiles + wallets** | 4,800 records |
| **Subscriptions + billing engine** | 5,500 records |
| **Projects + work modules** | 16,500 records |
| **Investment ecosystem** | 2,100 records |
| **Payments + financial engine** | 5,180 records |
| **CMS + media** | 1,570 records |
| **Notifications + comms** | 6,425 records |
| **System telemetry + infrastructure** | 8,300+ records |
| **Grand Total** | **~42,000 records** |

---

## Admin Login Credentials

| Role | Email | Password |
|------|-------|----------|
| **Super Admin** | admin@goexperts.in | Admin@12345 |
| Admin #1 | admin1@goexperts.in | Admin@12345 |
| Finance Manager #1 | financemanager1@goexperts.in | Admin@12345 |
| Support Executive #1 | supportexecutive1@goexperts.in | Admin@12345 |
| Content Manager #1 | contentmanager1@goexperts.in | Admin@12345 |
| Marketing Manager #1 | marketingmanager1@goexperts.in | Admin@12345 |
| HR Manager #1 | hrmanager1@goexperts.in | Admin@12345 |
| Moderator #1 | moderator1@goexperts.in | Admin@12345 |

> Admins #2 through #5 follow the same email pattern.

## Platform User Demo Accounts

| Role | Email Pattern | Password |
|------|---------------|----------|
| Freelancer | fl.arjun0@goexperts.com through fl.savitri499@goexperts.com | Admin@12345 |
| Client | cl.arjun0@goexperts.com through cl.savitri499@goexperts.com | Admin@12345 |
| Founder | fd.arjun0@goexperts.com through fd.savitri299@goexperts.com | Admin@12345 |
| Investor | inv.arjun0@goexperts.com through inv.savitri299@goexperts.com | Admin@12345 |

---

## Storage Metrics

| Metric | Value |
|--------|-------|
| SQLite dev.db size | ~8-12 MB |
| SQL dump file size | ~10 MB |
| SQL dump line count | 56,988 lines |
| Estimated MySQL size | ~15-20 MB |
