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

## Reviews Performed

No Lab 3 partner PR review has been recorded in this repository yet. A review
performed for Lab 2 is not carried forward as Lab 3 approval evidence.

| Date | Reviewer identity | Partner PR / reviewed commit | Comment given | Partner response / approval |
|---|---|---|---|---|
| — | — | — | No Lab 3 partner review recorded yet. | — |

## Release Review Evidence

PRs #48 through #55 were merged into `lab3-staging` after the recorded peer
reviews. Issues #44–#46 still require their own review records and final
staging-to-main release review. The final review must also verify the
[Definition of Done](specification.md#10-product-definition-of-done), test
results, screenshots, and the single Part 1–Part 9 submission PDF.
