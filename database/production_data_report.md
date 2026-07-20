# Go Experts Production Demo Database
## Data Report & Integration Guide

**Version:** Phase 11 Production Demo  
**Generated:** July 4, 2026  
**Status:** ✅ Verified — 42,000+ records successfully seeded

---

## Platform Overview

The Go Experts Production Demo Database is designed to simulate a **live, mature marketplace** that has been operating successfully for several years. Every dashboard widget, chart, filter, paginated table, and API endpoint will return meaningful, realistic data.

---

## Administrative Accounts (36 Users)

### Super Admin
| Field | Value |
|-------|-------|
| Email | admin@goexperts.in |
| Password | Admin@12345 |
| Role | Super Admin (all permissions) |

### Role-based Admin Staff (5 each)
| Role | Email Pattern | Count |
|------|---------------|-------|
| Admin | admin{1-5}@goexperts.in | 5 |
| Finance Manager | financemanager{1-5}@goexperts.in | 5 |
| Support Executive | supportexecutive{1-5}@goexperts.in | 5 |
| Content Manager | contentmanager{1-5}@goexperts.in | 5 |
| Marketing Manager | marketingmanager{1-5}@goexperts.in | 5 |
| HR Manager | hrmanager{1-5}@goexperts.in | 5 |
| Moderator | moderator{1-5}@goexperts.in | 5 |

---

## Platform User Demo Accounts

### Freelancers (500)
- Email pattern: `fl.{firstname}{index}@goexperts.com`
- Examples: `fl.arjun0@goexperts.com`, `fl.priya1@goexperts.com`
- All passwords: `Admin@12345`
- All accounts: verified, active
- Skills: Website, Flutter, React, Node, Python, AI, Cyber Security, SEO, Design, etc.
- Hourly rates: ₹350–₹8,000
- Ratings: 3.8–5.0

### Business Clients (500)
- Email pattern: `cl.{firstname}{index}@goexperts.com`
- Examples: `cl.arjun0@goexperts.com`, `cl.priya1@goexperts.com`
- All passwords: `Admin@12345`
- Companies: TCS, Infosys, Tech Mahindra, Reliance, Apollo, Airtel, Flipkart, etc.
- Total spend: ₹50,000–₹30,00,000

### Startup Founders (300)
- Email pattern: `fd.{firstname}{index}@goexperts.com`
- Examples: `fd.arjun0@goexperts.com`
- All passwords: `Admin@12345`
- Startup categories: AI CRM, EdTech, HealthTech, EV, FinTech, AgriTech, SaaS, etc.
- Stages: Ideation → MVP → Early Traction → Scaling → Series A/B

### Investors (300)
- Email pattern: `inv.{firstname}{index}@goexperts.com`
- Examples: `inv.arjun0@goexperts.com`
- All passwords: `Admin@12345`
- Types: Angel, VC, Private Equity, Corporate, Government Fund, Family Office, Seed Fund
- Ticket sizes: ₹5L–₹15Cr

---

## Key Data Characteristics

### Realistic Distributions
- **Project statuses:** Open (25%), In Progress (35%), Completed (30%), Cancelled (10%)
- **Proposal statuses:** Pending (40%), Shortlisted (20%), Accepted (15%), Rejected (20%), Interview/Offer (5%)
- **Contract statuses:** Active (40%), Completed (35%), Disputed (15%), Cancelled (10%)
- **Payment statuses:** Completed (97%), Failed (3%)
- **Subscription statuses:** Active (78%), Expired (22%)
- **Support ticket priorities:** Low (20%), Medium (40%), High (30%), Urgent (10%)

### Data Relationships
- Every project has: 3 milestones, 3 proposals, 1 contract, 5 tasks
- Every task has: 2 checklists, 1 time log, comments and attachments
- Every user has: wallet, subscription, notification preferences
- Every contract links: client → freelancer → proposal → project
- Every payment has: invoice, invoice item, optional refund

### Analytics Data
- **12 months of historical data** modeled through `createdAt` offsets (0–365 days ago)
- All API request logs spread across the last 12 months for chart population
- Payments, subscriptions, projects each have varied creation dates for revenue trend charts

---

## Super Admin Dashboard Coverage

| Dashboard Widget | Status |
|-----------------|--------|
| Total Users | ✅ 1,600 users |
| Active Subscriptions | ✅ ~700 active |
| Total Revenue | ✅ 1,000 payments |
| Open Support Tickets | ✅ 500 tickets |
| New Registrations Chart | ✅ Historical dates |
| Revenue Trend Chart | ✅ 12-month spread |
| Project Status Pie | ✅ 4 statuses |
| API Usage Chart | ✅ 1,500 logs |
| System Health | ✅ Alerts, backups, jobs |
| Startup Funding | ✅ 500 ideas, 1,000 deals |

---

## API Testing Notes

### Base URL
```
https://apiai.goexperts.in/api
```

### Auth Header
```
Authorization: Bearer <JWT from /api/admin/login>
```

### Login Payload
```json
{ "email": "admin@goexperts.in", "password": "Admin@12345" }
```

### Key Endpoints to Verify
- `GET /api/admin/users` — returns 1,600 paginated users
- `GET /api/admin/projects` — returns 500 projects
- `GET /api/admin/subscriptions` — returns 900 subscriptions  
- `GET /api/admin/payments` — returns 1,000 payments
- `GET /api/admin/support-tickets` — returns 500 tickets
- `GET /api/admin/startup-ideas` — returns 500 startup ideas
- `GET /api/admin/investments` — returns 1,000 investment records
- `GET /api/admin/notifications` — returns 2,000 notifications

---

## Flutter App Integration Notes

### Freelancer App
- Login with any `fl.{name}@goexperts.com` / `Admin@12345`
- Has subscription, active projects, proposals, reviews, wallet

### Client App
- Login with any `cl.{name}@goexperts.com` / `Admin@12345`
- Has company profile, posted projects, invoices, wallet

### Founder App
- Login with any `fd.{name}@goexperts.com` / `Admin@12345`
- Has startup idea, investor interest, meetings, deal room chats

### Investor App
- Login with any `inv.{name}@goexperts.com` / `Admin@12345`
- Has investment records, portfolio stats, meeting history

---

## Database Quality Checks

| Check | Result |
|-------|--------|
| Null FK violations | ✅ None |
| Duplicate unique emails | ✅ None |
| Orphan records | ✅ None |
| Missing wallet for user | ✅ All 1,600 wallets present |
| Missing profile for user | ✅ All 1,600 profiles present |
| Invalid subscription dates | ✅ All dates logically correct |
| Empty core tables | ✅ All 89 seeded tables populated |
