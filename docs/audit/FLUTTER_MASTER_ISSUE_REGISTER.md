# Flutter Master Issue Register

This register details all open issues discovered during forensic auditing.

| Issue ID | Severity | Role | Module | Screen / File | Problem Summary | Recommended Fix |
|---|---|---|---|---|---|---|
| **ISSUE-001** | P2 | All Roles | Auth | `login_page.dart` | LinkedIn sign-in button displays snackbar "Coming Soon" | Implement backend OAuth callback if required |
| **ISSUE-002** | P2 | Freelancer | Projects | `project_details_page.dart` | Project share button relies on native `share_plus` plugin | Verify share link deep-link scheme |
| **ISSUE-003** | P3 | Client | Team | `client_subpages.dart` | Team invitation list does not paginate when team size > 50 | Add infinite scroll pagination |
| **ISSUE-004** | P3 | Founder | Funding | `my_startup_view.dart` | Pitch deck preview relies on PDF viewer helper | Cache rendered thumbnail previews locally |

No P0 (Production Blockers) or P1 (Critical Defects) were found.
