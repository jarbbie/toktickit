# Lab 3 Peer Review Record

## Identity and Recording Rules

Author: Peeranat Ngamkiatkajorn — GitHub `@jarbbie`.

The Lab 3 feature PRs were reviewed by SupeemAFK (`@SupeemAFK`). Each entry
below records the review request, requested changes when applicable, the author
response, and the final approval before merge. AI-assisted review is not used as
peer approval.

## Reviews Received

| Date | Reviewer | PR / reviewed commit | Comment or verdict | Author response / resulting change | Approval |
|---|---|---|---|---|---|
| 2026-09-18 | SupeemAFK | [#48](https://github.com/jarbbie/toktickit/pull/48) | Reviewed the engineering contract against the labsheet; scope, authorization/status rules, API/UI specifications, migration approach, and test traceability were coherent. No blocking issues. | No changes requested. | Approved; merged. |
| 2026-09-18 | SupeemAFK | [#49](https://github.com/jarbbie/toktickit/pull/49) | Requested the resolution-indication timestamp be aligned with the approved specification/API/UI contract. | Renamed the persisted field consistently to `resolutionIndicatedAt` across migration, Prisma model, seed, and tests. | Re-reviewed and approved; merged. |
| 2026-09-18 | SupeemAFK | [#50](https://github.com/jarbbie/toktickit/pull/50) | Authentication, session cookie, password-change, origin-validation, rate-limit, and integration behavior aligned with the contract. No blocking issues. | No changes requested. | Approved; merged. |
| 2026-09-18 | SupeemAFK | [#51](https://github.com/jarbbie/toktickit/pull/51) | Selector removal, session bootstrap, mandatory password-change routing, role navigation/direct-route guards, and logout clearing aligned with the contract. No blocking issues. | No changes requested. | Approved; merged. |
| 2026-09-18 | SupeemAFK | [#52](https://github.com/jarbbie/toktickit/pull/52) | Requested that ticket creation copy Requested Priority into IT Priority and that resolution indication preserve the first timestamp under concurrent requests. | Set `itPriority` from the validated requested priority; added a conditional first-writer-wins resolution update and race coverage. | Re-reviewed and approved; merged. |
| 2026-09-18 | SupeemAFK | [#53](https://github.com/jarbbie/toktickit/pull/53) | Queue authorization, filters, ownership modes, semantic sorting, stable ties, pagination, and responsive views aligned with the contract. No blocking issues. | No changes requested. | Approved; merged. |
| 2026-09-18 | SupeemAFK | [#54](https://github.com/jarbbie/toktickit/pull/54) | Staff detail, claim/assignment, IT Priority, status transitions, attachment access, and Internal Notes matched the contract. No blocking issues. | No changes requested. | Approved; merged. |
| 2026-09-18 | SupeemAFK | [#55](https://github.com/jarbbie/toktickit/pull/55) | Requested that the staff detail route remain inside the authenticated Shell so navigation and logout were not lost. | Wrapped `/staff/tickets/:ticketId` in `Shell` and added an App-level navigation/logout regression test. | Re-reviewed commit `8a596b0` and approved; merged. |
| 2026-09-18 | SupeemAFK | [#56](https://github.com/jarbbie/toktickit/pull/56) | Reviewed the Administrator-only user list/search/filter, normalized unique creation, safe DTOs, validated edits, session revocation, self-deactivation/last-admin/assigned-owner safeguards, password reset, and shared account-owner locking. No blocking issues. | No changes requested. | Approved commit `63da854`; merged. |
| 2026-09-19 | SupeemAFK | [#57](https://github.com/jarbbie/toktickit/pull/57) | Reviewed the authenticated Administrator UI, safe list/search/role filtering, create/edit/reset modes, validation, draft preservation, activation and self-admin safeguards, responsive layouts, and direct-route denial. No blocking issues. | No changes requested. | Approved commit `26437ba`; merged. |

## Reviews Performed

These entries record the Lab 3 reviews performed for partner repository
`SupeemAFK/TokTickIT-Individual-Sprints`. A review performed for Lab 2 is not
carried forward as Lab 3 approval evidence. The GitHub review history for the
partner's PRs #44–#49 contains no formal review or conversation record, so
those PRs are not represented as approvals here.

| Date | Reviewer identity | Partner PR / reviewed commit | Comment given | Partner response / approval |
|---|---|---|---|---|
| 2026-09-18 | `@jarbbie` | [SupeemAFK PR #50](https://github.com/SupeemAFK/TokTickIT-Individual-Sprints/pull/50), reviewed through `e112d53`, `982c4a1`, `e963c1c`, `4703c7b`, and `faf1f68` | Requested successive contract corrections covering owner-integrity lifecycle rules, exact API response/error shapes, role permissions, seed credentials, migration/requester-link behavior, test traceability, and stale review metadata. | SupeemAFK responded with commits `ef68866`, `982c4a1`, `09b3cdb`, `e963c1c`, `fd4d09a`, `4703c7b`, and `faf1f68`. [Final re-review approved](https://github.com/SupeemAFK/TokTickIT-Individual-Sprints/pull/50#pullrequestreview-5252896915) the corrected documentation contract; PR #50 was merged. |
| 2026-09-18 | `@jarbbie` | [SupeemAFK PR #51](https://github.com/SupeemAFK/TokTickIT-Individual-Sprints/pull/51), reviewed at `e4a785c` and `63881d` | Requested changes for unauthenticated requester-route/security bypasses, missing persistent sessions and first-login access, incomplete staff/admin API behavior, non-atomic status handling, owner safeguards, and lost Lab 2 regression coverage. After the first response, requested canonical requester detail wrappers, full workflow-status filtering, restored requester filters/pagination, and restored negative-path regression tests. | SupeemAFK responded in `25f268c` and `3a7e959`, reporting those fixes with server/client verification. The PR remained open and [latest re-review remained changes requested](https://github.com/SupeemAFK/TokTickIT-Individual-Sprints/pull/51#pullrequestreview-5253284174); no approval was recorded after the latest response, so approval is pending. |

## Release Review Evidence

PRs #48 through #57 were merged into `lab3-staging` after the recorded peer
reviews. PR [#58](https://github.com/jarbbie/toktickit/pull/58) completed Issue
#46's final verification and was merged into `lab3-staging` on 2026-09-19; no
peer approval is claimed for that release-verification PR until an actual
GitHub review is recorded. The final staging-to-main release review must also verify the
[Definition of Done](specification.md#10-product-definition-of-done), test
results, screenshots, and the single Part 1–Part 9 submission PDF.
