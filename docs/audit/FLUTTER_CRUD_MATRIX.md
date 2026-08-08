# Flutter Complete CRUD Matrix

This matrix evaluates CRUD operations across all platform domain entities.

| Entity | List | View | Add | Edit | Delete | Actions | Flutter UI | Flutter API | Backend API | DB Entity |
|---|---|---|---|---|---|---|---|---|---|---|
| **Projects** | ✅ | ✅ | ✅ | ✅ | ⚠️ | Publish / Close | ✅ | ✅ | ✅ | `Project` |
| **Proposals** | ✅ | ✅ | ✅ | ⚠️ | ✅ | Withdraw / Accept | ✅ | ✅ | ✅ | `Proposal` |
| **Contracts** | ✅ | ✅ | ❌ | ❌ | ❌ | Activate / Complete | ✅ | ✅ | ✅ | `Contract` |
| **Tasks** | ✅ | ✅ | ✅ | ✅ | ⚠️ | Timer Start / Stop | ✅ | ✅ | ✅ | `Task` |
| **Milestones** | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | Approve / Reject | ✅ | ✅ | ✅ | `Milestone` |
| **Portfolio** | ✅ | ✅ | ✅ | ✅ | ✅ | Upload Cover/Video | ✅ | ✅ | ✅ | `PortfolioItem` |
| **Certificates** | ✅ | ✅ | ✅ | ⚠️ | ✅ | Verify Document | ✅ | ✅ | ✅ | `Certificate` |
| **Education** | ✅ | ✅ | ✅ | ⚠️ | ✅ | Verification | ✅ | ✅ | ✅ | `Education` |
| **Startup Ideas**| ✅ | ✅ | ✅ | ✅ | ❌ | Funding Pitch | ✅ | ✅ | ✅ | `FounderProfile` |
| **Investments** | ✅ | ✅ | ✅ | ❌ | ❌ | Offer / Cancel | ✅ | ✅ | ✅ | `Investment` |
| **Watchlist** | ✅ | ✅ | ✅ | ❌ | ✅ | Add / Remove Notes | ✅ | ✅ | ✅ | `Watchlist` |
| **Team** | ✅ | ✅ | ✅ | ⚠️ | ✅ | Invite Email | ✅ | ✅ | ✅ | `TeamMember` |
| **Invoices** | ✅ | ✅ | ❌ | ❌ | ❌ | Download PDF | ✅ | ✅ | ✅ | `Invoice` |
| **Support** | ✅ | ✅ | ✅ | ❌ | ❌ | Reply / Close | ✅ | ✅ | ✅ | `SupportTicket` |

Legend:
- ✅ Working
- ⚠️ Partial
- ❌ Missing
