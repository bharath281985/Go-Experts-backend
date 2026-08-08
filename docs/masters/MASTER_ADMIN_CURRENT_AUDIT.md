# Go Experts — Master Admin Current Architecture Audit Report (Step 1)

## Executive Overview
This forensic audit evaluates the complete Master Data Management (MDM) architecture across the **Super Admin Web Portal** (`d:\goexperts\goexperts-nexus-main`), the **Node.js / Express / Prisma Backend** (`d:\goexperts\Go-Experts-backend`), and the **MySQL Database Schema**.

---

## 1. Master Data Entities & Database Model Audit

| Master Data Taxonomy | Database Table | Prisma Model | Primary Key | Total Records | Active Records | Inactive Records | Status |
|---|---|---|---|---|---|---|---|
| **Industries** | `industries` | `Industry` | `id` (UUID) | 134 | 134 | 0 | **CONNECTED** |
| **Skill Categories** | `skill_categories` | `SkillCategory` | `id` (UUID) | 71 | 71 | 0 | **CONNECTED** |
| **Skills** | `skills` | `Skill` | `id` (UUID) | 1,815 | 1,815 | 0 | **CONNECTED** |
| **Technologies** | `master_options` (`type: technology`) | `MasterOption` | `id` (UUID) | 708 | 708 | 0 | **CONNECTED** |
| **Countries** | `countries` | `Country` | `id` (UUID) | 13 | 13 | 0 | **CONNECTED** |
| **States & UTs** | `master_options` (`type: state`) | `MasterOption` | `id` (UUID) | 36 | 36 | 0 | **CONNECTED** |
| **Cities** | `master_options` (`type: city`) | `MasterOption` | `id` (UUID) | 105 | 105 | 0 | **CONNECTED** |
| **Languages** | `languages` | `Language` | `id` (UUID) | 1 | 1 | 0 | **CONNECTED** |
| **Currencies** | `currencies` | `Currency` | `id` (UUID) | 1 | 1 | 0 | **CONNECTED** |
| **Designations** | `master_options` (`type: designation`) | `MasterOption` | `id` (UUID) | 165 | 165 | 0 | **CONNECTED** |
| **Experience Levels** | `experience_levels` | `ExperienceLevel` | `id` (UUID) | 5 | 5 | 0 | **CONNECTED** |
| **Work Modes** | `work_modes` | `WorkMode` | `id` (UUID) | 5 | 5 | 0 | **CONNECTED** |
| **Startup Stages** | `startup_stages` | `StartupStage` | `id` (UUID) | 10 | 10 | 0 | **CONNECTED** |
| **Startup Goals** | `master_options` (`type: startup_goal`) | `MasterOption` | `id` (UUID) | 39 | 39 | 0 | **CONNECTED** |
| **Investor Types** | `master_options` (`type: investor_type`) | `MasterOption` | `id` (UUID) | 25 | 25 | 0 | **CONNECTED** |
| **Investment Types** | `master_options` (`type: investment_type`) | `MasterOption` | `id` (UUID) | 18 | 18 | 0 | **CONNECTED** |
| **Subscription Plans** | `subscription_plans` | `SubscriptionPlan` | `id` (UUID) | 4 | 4 | 0 | **CONNECTED** |

---

## 2. API Endpoint Architecture

Generic REST CRUD routes mounted in `Go-Experts-backend/src/routes/index.ts`:
- `GET /api/admin/:table` — List records (supports `page`, `pageSize`, `search`, `filters`)
- `POST /api/admin/:table` — Create master record
- `PUT /api/admin/:table/:id` — Update master record
- `DELETE /api/admin/:table/:id` — Delete record
- `POST /api/admin/:table/bulk-delete` — Bulk delete
- `POST /api/admin/:table/bulk-status` — Bulk update status (`active` / `inactive`)

---

## 3. Current Problems & Redesign Target Objectives

1. **Information Architecture:** Horizontal tabs do not scale for 30+ master types. Replacing with 7 Logical Group Workspaces.
2. **Relational Protection:** Implementing pre-deletion check across `User`, `FreelancerProfile`, `ClientProfile`, `Project`, and `FounderProfile` tables.
3. **Data Quality Center:** Adding automated checks for duplicates, orphan records, and missing metadata.
