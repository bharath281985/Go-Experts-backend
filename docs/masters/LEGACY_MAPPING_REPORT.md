# Legacy Data & Normalization Mapping Report

This report documents how legacy user profile fields and raw text entries are backward-compatibly normalized and mapped to master tables.

## Legacy Field Normalization Matrix

| Legacy Profile Field | Unstructured Storage Location | Canonical Master Entity | Mapping & Normalization Strategy |
|---|---|---|---|
| `user.country` | `users.country` (String) | `Country.name` / `Country.code` | Exact string match with fallback to default country `India` (`IN`) |
| `user.city` | `users.city` (String) | `MasterOption` (`type: city`) | Trimmed, case-normalized string with fuzzy search support |
| `freelancerProfile.skills` | `freelancer_profiles.skills` (Comma-separated String) | `Skill.name` / `Skill.id` | Parsed into array, mapped against canonical skill names, aliases resolved (e.g. `ReactJS` $\rightarrow$ `React`) |
| `freelancerProfile.industry` | `freelancer_profiles.industry` (String) | `Industry.name` / `Industry.id` | Checked against UUID vs Name; resolves to canonical `Industry.name` |
| `clientProfile.company` | `client_profiles.company` (String) | User input | Preserved as free-form company name |
| `investorProfile.focusAreas` | `investor_profiles.focus_areas` (Comma-separated String) | `Industry.name` / `SkillCategory.name` | Mapped against normalized industry list |
| `founderProfile.stage` | `founder_profiles.stage` (String) | `MasterOption` (`type: startup_stage`) | Normalized to standard stage values (e.g. `MVP / Beta`, `Early Revenue`) |
