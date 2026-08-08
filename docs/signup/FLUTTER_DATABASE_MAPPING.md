# Flutter Database Mapping & Persistence Report

This report confirms how Flutter mobile onboarding payloads map directly to MySQL database entities.

## Database Entity Mapping Matrix

| Platform Role | Flutter Mobile Input Data | MySQL Target Tables | Foreign Keys & Relational Mappings |
|---|---|---|---|
| **Freelancer** | Step 1 Credentials $\rightarrow$ Step 2 Bio $\rightarrow$ Step 3 Skill IDs $\rightarrow$ Step 4 Experience | `User`, `FreelancerProfile`, `FreelancerSkill` | Composite unique `[freelancerId, skillId]`, foreign key to `User.id` |
| **Client** | Step 1 Account $\rightarrow$ Step 2 Business Info $\rightarrow$ Step 3 Designation | `User`, `ClientProfile` | Foreign key to `User.id`, Master IDs stored |
| **Investor** | Step 1 Account $\rightarrow$ Step 2 Designation $\rightarrow$ Step 3 Industry IDs & Stage | `User`, `InvestorProfile`, `InvestorPreferredIndustry` | Composite unique `[investorId, industryId]` |
| **Founder** | Step 1 Account $\rightarrow$ Step 2 Startup Details $\rightarrow$ Step 3 Designation $\rightarrow$ Step 4 Goal IDs | `User`, `FounderProfile` | Foreign key to `User.id`, relational goal mapping |

Flutter treats backend API responses as the single source of truth and does not maintain un-synced local state after API calls.
