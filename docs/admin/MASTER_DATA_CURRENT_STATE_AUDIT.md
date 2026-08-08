# Super Admin Master Data Current State Audit Report — Step 1

## Executive Summary
This audit inspects the current Master Data Management (MDM) architecture across the **Super Admin Nexus Application** (`d:\goexperts\goexperts-nexus-main`), the **Node.js / Express / Prisma Backend** (`d:\goexperts\Go-Experts-backend`), and the **MySQL Database Schema**.

---

## 1. Master Data Entities & Database Inventory

| Master Entity | Prisma Model | MySQL Target Table | Primary Key | Current UI Tab | Active Record Count |
|---|---|---|---|---|---|
| **Skill Categories** | `SkillCategory` | `skill_categories` | `id` (UUID) | Categories | 71 Categories |
| **Skills** | `Skill` | `skills` | `id` (UUID) | Skills | 1,815 Skills |
| **Industries** | `Industry` | `industries` | `id` (UUID) | Industries | 134 Industries |
| **Countries** | `Country` | `countries` | `id` (UUID) | Countries | 13 Countries |
| **Currencies** | `Currency` | `currencies` | `id` (UUID) | Currencies | 1 Currency (INR) |
| **Languages** | `Language` | `languages` | `id` (UUID) | Languages | 1 Language (English) |
| **Pricing Plans** | `SubscriptionPlan` | `subscription_plans` | `id` (UUID) | Subscription Plans | 4 Plans |
| **Work Modes** | `MasterOption` | `master_options` (`type: work_mode`) | `id` (UUID) | Work Modes | 5 Options |
| **Experience Levels** | `MasterOption` | `master_options` (`type: experience_level`) | `id` (UUID) | Experience Levels | 5 Options |
| **Designations** | `MasterOption` | `master_options` (`type: designation`) | `id` (UUID) | (In MasterOption) | 165 Options |
| **Startup Goals** | `MasterOption` | `master_options` (`type: startup_goal`) | `id` (UUID) | (In MasterOption) | 39 Options |
| **Startup Stages** | `MasterOption` | `master_options` (`type: startup_stage`) | `id` (UUID) | (In MasterOption) | 10 Options |
| **Investor Types** | `MasterOption` | `master_options` (`type: investor_type`) | `id` (UUID) | (In MasterOption) | 25 Options |
| **Investment Types** | `MasterOption` | `master_options` (`type: investment_type`) | `id` (UUID) | (In MasterOption) | 18 Options |

---

## 2. Identified Limitations in Current Super Admin UI

1. **Horizontal Tabs Overflow:** Currently uses horizontal tabs (`<TabsList>`) in `_admin.masters.tsx`. As master types expand beyond 9 items, tabs wrap awkwardly and become difficult to navigate.
2. **Missing Grouping / Classification:** Masters are currently un-grouped. Business, Geography, Professional, Startup, and Investment masters are mixed together.
3. **No Dependency Protection:** Deleting a master record does not check relational usage in `User`, `FreelancerProfile`, `ClientProfile`, or `Project` tables prior to deletion.
4. **Limited Metadata Display:** Enterprise columns (such as aliases, keywords, usage counts, last updated by) are missing from the primary table view.
5. **No Usage Analysis Drawer:** Super Admin cannot view how many Freelancers or Projects depend on an Industry before deactivating it.

---

## 3. Targeted Upgrade Architecture

- **Information Architecture:** Group masters into 7 Enterprise Catalog Categories (Core Business, Geography, Localization, Work & Professional, Business, Startup, Investment, Platform).
- **Master Data Catalog Overview:** Summary cards showing Total Master Types, Total Active Records, Inactive Records, and Data Quality Issues.
- **Enterprise MasterDataTable:** Server-side debounced search, bulk status toggles, drawer forms for Create/Edit/View, and dependency drawers.
