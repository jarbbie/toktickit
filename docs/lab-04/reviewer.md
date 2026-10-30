# Lab 4 Peer Review Record

**Status:** Issues #67–#74 were reviewed by SupeemAFK and merged into
`lab4-staging`. Promotion to `main` and final-main verification are pending
under Issue #75.

## Recording rules

- Author: jarbbie.
- Peer reviewer: SupeemAFK.
- Record each review request, requested change, author fix, approval, and merge
  from GitHub evidence. AI feedback is not peer approval.
- Dates below are UTC. A merge is recorded separately from approval.

## Reviews received

| Date | PR / issue | Review and requested changes | Resolution and final review |
|---|---|---|---|
| 2026-10-27 to 2026-10-28 | [#76 / #67](https://github.com/jarbbie/toktickit/pull/76) | CHANGES_REQUESTED: clarify parent Ticket mutability, safe Requester summaries, support Action-event shape/UI, and ordering coverage; then correct the review-record citation. | Contract and record were corrected. SupeemAFK approved reviewed head `b0968a90e92ef6394f12d4e61bf1419f78fee38e` at 12:07Z on 2026-10-28; merged at 12:08Z. |
| 2026-10-28 | [#77 / #68](https://github.com/jarbbie/toktickit/pull/77) | CHANGES_REQUESTED: preserve seed invariants on changed legacy data; make reruns backfill the completion Action; avoid mutating an already-resolved fixture in conflict with the approved lifecycle contract. | Seed repair moved to a new deterministic sample and preserves the prior terminal Ticket. SupeemAFK approved reviewed head `a6afcccd3fde91977568bc8d746590ccb2ed083e` at 17:25Z; merged at 17:25Z. |
| 2026-10-28 to 2026-10-29 | [#78 / #69](https://github.com/jarbbie/toktickit/pull/78) | CHANGES_REQUESTED: same-assignee retry after that account is deactivated must remain a read-only 200; add a regression. | The no-op comparison now precedes active-account validation. Approval at 16:26Z on 2026-10-29; merged at 16:27Z. |
| 2026-10-29 | [#79 / #70](https://github.com/jarbbie/toktickit/pull/79) | CHANGES_REQUESTED: interpret Action date/time in Bangkok independently of browser timezone and preserve stored seconds when another field is edited. | Explicit `Asia/Bangkok` formatting/submission and unchanged-date omission were added with regressions. Approval at 17:44Z; merged at 17:44Z. |
| 2026-10-29 | [#80 / #71](https://github.com/jarbbie/toktickit/pull/80) | CHANGES_REQUESTED: preserve stale targets visibly while preventing illegal resubmission, and apply `no-store` to workflow responses before auth/handler failures. | Both fixes and error-header/UI regressions were added. Approval at 18:34Z; merged at 18:36Z. |
| 2026-10-29 | [#81 / #72](https://github.com/jarbbie/toktickit/pull/81) | APPROVED: dashboard metrics, seven-day Bangkok window, bounded summaries, drill-downs, staff ordering, authorization, and safe responses aligned with the contract. | Approved at 18:54Z and merged at 18:55Z. |
| 2026-10-29 | [#82 / #73](https://github.com/jarbbie/toktickit/pull/82) | CHANGES_REQUESTED: keep resolved-date sort newest-first, remove direction control for fixed urgent-work ordering, and focus Ticket Detail after asynchronous load. | All three fixes and regressions were added. Approved reviewed head `a5a394bd5df9f61c388559402f482913ce6d7f51` at 19:32Z; merged at 19:34Z. |
| 2026-10-29 | [#83 / #74](https://github.com/jarbbie/toktickit/pull/83) | APPROVED: root E2E discovery retained Labs 2–3 coverage; workflow-rule extraction, inherited resolution setup, performance smoke, and traceability aligned with the merged contract. | SupeemAFK [approved](https://github.com/jarbbie/toktickit/pull/83#pullrequestreview-5704279579) reviewed head `2fb3097f079703b7b2f32d8040b0c2e803189de6` at 20:10Z; merged into `lab4-staging` at 20:11Z. |

## Integration record

| Issue | PR / branch | Destination | Final reviewed head | Merge commit | Status |
|---|---|---|---|---|---|
| #67 | [#76](https://github.com/jarbbie/toktickit/pull/76), `feature/67-lab4-contract` | `lab4-staging` | `b0968a90e92ef6394f12d4e61bf1419f78fee38e` | `a0eaa8fe78b4e4faaccd3ad48181891adef34035` | Approved and merged 2026-10-28 |
| #68 | [#77](https://github.com/jarbbie/toktickit/pull/77), `feature/68-lab4-data-foundation` | `lab4-staging` | `a6afcccd3fde91977568bc8d746590ccb2ed083e` | `e69876082410ea4601198c71bfc9d03df9385f08` | Approved and merged 2026-10-28 |
| #69 | [#78](https://github.com/jarbbie/toktickit/pull/78), `feature/69-lab4-actions-api` | `lab4-staging` | `5caca560ac759e4ff840953da46345fd546913ee` | `33b0a05600b38fa5fa24a9d2d4db1953a5170484` | Approved and merged 2026-10-29 |
| #70 | [#79](https://github.com/jarbbie/toktickit/pull/79), `feature/70-lab4-actions-ui` | `lab4-staging` | `2784b4de38be4abc75fb604d4567392a367f8485` | `25fa17dc136e9ddb17e633b3a401e32307987e99` | Approved and merged 2026-10-29 |
| #71 | [#80](https://github.com/jarbbie/toktickit/pull/80), `feature/71-lab4-ticket-workflow` | `lab4-staging` | `10419448298b87aa80ad46c5d28bdf4b14b84a92` | `4b0cd0ba3e881889104973cf9f6a7e2397e9f8c3` | Approved and merged 2026-10-29 |
| #72 | [#81](https://github.com/jarbbie/toktickit/pull/81), `feature/72-lab4-dashboard-api` | `lab4-staging` | `ad17126a8d6be1465fc9b155c3c9ae8115335e4f` | `b3ce566e8af3909b37b1ede8b03740094608f0c6` | Approved and merged 2026-10-29 |
| #73 | [#82](https://github.com/jarbbie/toktickit/pull/82), `feature/73-lab4-dashboard-ui` | `lab4-staging` | `a5a394bd5df9f61c388559402f482913ce6d7f51` | `17734a4a0343999cc9b4b4d33ad00edf853f326c` | Approved and merged 2026-10-29 |
| #74 | [#83](https://github.com/jarbbie/toktickit/pull/83), `feature/74-lab4-regression-hardening` | `lab4-staging` | `2fb3097f079703b7b2f32d8040b0c2e803189de6` | `56f7e2c09b9d60c87ff7922fe6d96c6d852bf283` | Approved and merged 2026-10-29 |

## Evidence boundary

Review identities, verdicts, reviewed heads, and merge SHAs above come from
GitHub PR review and merge records. Issue #75 release review and final-main
verification will be recorded after those steps complete.
