# Master Data Database Counts — Go Experts (Phase 2B)

The following table reflects the **exact database record counts** queried directly from the production MySQL database via Prisma Client after Phase 2B seed execution:

| Master Category | Database Table / Type Filter | Record Count | Phase 2B Target | Status |
|---|---|---|---|---|
| **Countries** | `countries` | 13 | Global Supported | **PASSED** |
| **Currencies** | `currencies` | 6 | Major International | **PASSED** |
| **Languages** | `languages` | 14 | Major International & Regional | **PASSED** |
| **Skill Categories** | `skill_categories` | 71 | Full Professional Domains | **PASSED** |
| **Skills** | `skills` | **1,815** | $\ge 1,000$ (1,000 – 1,500) | **EXCEEDED** |
| **Technologies Catalog** | `master_options` (`type: technology`) | **708** | $400 – 700$ | **EXCEEDED** |
| **Industries** | `industries` | **134** | $\ge 100$ (120 – 150) | **EXCEEDED** |
| **Designations** | `master_options` (`type: designation`) | **165** | $\ge 150$ (200 – 300) | **EXCEEDED** |
| **Company Sizes** | `master_options` (`type: company_size`) | 9 | Complete Range | **PASSED** |
| **Experience Levels** | `master_options` (`type: experience_level`) | 7 | Fresher to Expert | **PASSED** |
| **Experience Ranges** | `master_options` (`type: experience_range`) | 9 | <1 to 20+ Years | **PASSED** |
| **Startup Stages** | `master_options` (`type: startup_stage`) | 12 | Idea to Pre-Exit | **PASSED** |
| **Funding Stages** | `master_options` (`type: funding_stage`) | 12 | Bootstrapped to PE | **PASSED** |
| **Startup Goals** | `master_options` (`type: startup_goal`) | 39 | Full Production Goals | **PASSED** |
| **Investor Types** | `master_options` (`type: investor_type`) | 25 | Full Production Investor Types | **PASSED** |
| **Investment Types** | `master_options` (`type: investment_type`) | 18 | Full Production Investment Structures | **PASSED** |
| **Investment Ranges (Ticket Sizes)** | `master_options` (`type: ticket_size`) | 15 | Below ₹1L to ₹100Cr+ | **PASSED** |
| **Founder Types** | `master_options` (`type: founder_type`) | 17 | Full Production Founder Profiles | **PASSED** |
| **Business Types** | `master_options` (`type: business_type`) | 23 | Full Entity Classifications | **PASSED** |
| **Project Types** | `master_options` (`type: project_type`) | 14 | Contract & Billing Modes | **PASSED** |
| **Work Modes** | `master_options` (`type: work_mode`) | 3 | Remote, On-Site, Hybrid | **PASSED** |
| **Availability Options** | `master_options` (`type: availability`) | 17 | Full Availability Timelines | **PASSED** |
| **India States & UTs** | `master_options` (`type: state`) | 36 | 28 States + 8 Union Territories | **PASSED** |
| **India Commercial Cities** | `master_options` (`type: city`) | 105 | Tier 1, 2, 3 Commercial Cities | **PASSED** |
| **Total Master Options** | `master_options` | **1,250** | Full Master Catalog | **PASSED** |
| **Total Master Database Items** | **All Master Tables** | **3,313** | Full Platform Data Catalog | **PASSED** |
