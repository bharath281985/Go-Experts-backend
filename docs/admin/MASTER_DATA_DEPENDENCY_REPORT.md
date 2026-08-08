# Master Data Dependency Protection Report

## Relational Protection Mechanism
Before deleting any master entity (e.g. Industry, Skill, Designation), the Super Admin backend checks foreign key dependencies across live user and project tables:

- **`User` Table:** Primary profile industry/country preferences.
- **`FreelancerProfile` & `FreelancerSkill`:** Freelancer skill tags and categories.
- **`ClientProfile` & `Project`:** Industry requirements and project skill tags.
- **`InvestorProfile`:** Preferred industries and investment ranges.
- **`FounderProfile`:** Startup industry and goal selections.

If a master record is in use, permanent deletion is blocked with a user-friendly alert, recommending **Deactivation** instead of physical row deletion to preserve relational integrity.
