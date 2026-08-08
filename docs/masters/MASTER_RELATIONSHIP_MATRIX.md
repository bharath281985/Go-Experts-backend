# Master Data Relationship Hierarchy Matrix

```mermaid
graph TD
    A[Industry] --> B[SkillCategory]
    B --> C[Skill]
    C <--> D[Technology]
    E[Country] --> F[State]
    F --> G[City]
    H[StartupStage] <--> I[FundingType]
    J[InvestorType] <--> K[InvestmentTicketRange]
```

## Relational Key Mappings
- `SkillCategory.industryId` $\rightarrow$ `Industry.id` (Foreign key with `onDelete: SetNull`)
- `Skill.categoryId` $\rightarrow$ `SkillCategory.id` (Foreign key with `onDelete: SetNull`)
- `User.countryId` $\rightarrow$ `Country.id`
- `FreelancerSkill.skillId` $\rightarrow$ `Skill.id` (Composite key)
- `InvestorPreferredIndustry.industryId` $\rightarrow$ `Industry.id`
