# Master Data Management (MDM) Redesign & Governance Architecture

## 1. Enterprise Information Architecture
The MDM module reorganizes 3,313 reference records across **7 Domain Groups**:
1. **Talent & Skills:** Skill Categories (71), Skills (1,815), Technologies (708), Designations (165), Experience Levels (5), Work Modes (5), Availability (17).
2. **Business:** Industries (134), Business Types (23), Company Sizes (8).
3. **Projects:** Project Types (14), Engagement Types (6).
4. **Startups:** Founder Types (17), Startup Stages (10), Startup Goals (39), Funding Types (5).
5. **Investments:** Investor Types (25), Investment Ticket Ranges (18).
6. **Location:** Countries (13), States & UTs (36), Tier 1/2/3 Cities (105), Languages (1), Currencies (1).
7. **Platform:** Subscription Plans (4).

---

## 2. Relational Protection & Data Governance
- **Pre-Deletion Relational Check:** Permanently deleting a master checks foreign keys in `User`, `FreelancerProfile`, `ClientProfile`, `InvestorProfile`, `FounderProfile`, `Project`, and `StartupIdea` tables.
- **Deactivation Alternative:** If a master entity is referenced in live database records, deletion is blocked, recommending **Deactivation** instead.
