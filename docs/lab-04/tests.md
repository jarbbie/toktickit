# Lab 4 Test-Driven Development and Traceability Plan

**Merged baseline:** PR #85 was approved and merged to `main` at
`ae4dfd3cf90024a676bceafc426b019d1265124d` on 2026-10-31. Its final-main
verification is recorded in the PR and summarized below.

**Part 5 rubric addendum:** the Staff/Admin dashboard now includes a
current-user Actions Taken count and recent list. The implementation,
contract addendum, and regression checks below are verified in the current
working copy on 2026-11-01; this addendum still needs peer review and merge
before it can be described as part of `main`.
PostgreSQL tests require a disposable `TEST_DATABASE_URL` whose database name
ends in `_test`.

TDD loop: add a focused failing test → record the red result → implement the
smallest approved change → run focused and inherited regressions → record the
actual green result and commit. Contract changes update specification, API/UI,
and this matrix before implementation continues.

## 1. Planned Test Matrix

| Test ID | Type | ACs | What it proves / expected result | Planned path | Status |
|---|---|---|---|---|---|
| UNIT-01 | Unit | AC-01, AC-04, AC-06 | Action text/date/follow-up validation accepts boundaries and rejects invalid values; false follow-up clears current note. | server/tests/lab-04/action-rules.test.ts | Passed; 2026-10-30 |
| UNIT-02 | Unit | AC-05, AC-10, AC-11 | Every Action/Ticket transition pair agrees with documented matrices; same/terminal transitions reject. | server/tests/lab-04/workflow-rules.test.ts | Passed; 2026-10-30 |
| MIG-01 | Migration integration | AC-13 | Migrate a populated Lab 3 copy and compare IDs, relationships, timestamps, attachments/files, and sequences before/after. | server/tests/lab-04/migration.integration.test.ts | Passed locally; 2026-10-28 |
| MIG-02 | Recovery integration | AC-13 | Force an additive-migration DDL conflict in a disposable schema, prove rollback preserves legacy rows and columns, remove the conflict, and retry successfully without reset. | server/tests/lab-04/migration-recovery.integration.test.ts | Passed locally; 2026-10-28 |
| SEED-01 | Seed integration | AC-14, AC-16 | Clean seed records a valid recent resolution with a completed Action, advances parent workflow versions/activity timestamps for Action mutations, and remains repeat-safe without overwriting edited data. | server/tests/lab-04/seed.integration.test.ts | Passed locally; 2026-10-28 |
| SEED-02 | Populated seed integration | AC-13, AC-14, AC-16 | Preserve existing RESOLVED/CLOSED/CANCELLED Tickets and their history; rehome missing Action samples to an active seed Ticket; create a new versioned recent-resolution sample with a completed Action before its resolution instead of mutating the earlier terminal fixture; rerun without writes to legacy rows or duplicate Actions/events. | server/tests/lab-04/seed.integration.test.ts | Passed locally; 2026-10-28 |
| DB-GUARD-01 | Unit | AC-13 | Reject unsafe or non-PostgreSQL test URLs before any temporary schema is created. | server/tests/lab-04/database-test-utils.test.ts | Passed locally; 2026-10-28 |
| API-01 | API/authz | AC-01, AC-07, AC-12 | Requester reads own Actions/history only; forged owner/actor fields are rejected; cross-owner reads are concealed as 404; Staff/Admin read all. | server/tests/lab-04/actions-taken.api.test.ts | Passed locally; 2026-10-29 |
| API-02 | API/integration | AC-02, AC-05, AC-16 | Create Action derives performer from session, stores event, returns 201; exact idempotency replay returns same record; mismatched key replay returns 409. | server/tests/lab-04/actions-taken.api.test.ts | Passed locally; 2026-10-29 |
| API-03 | API/authz | AC-03, AC-07 | Assign/reassign/unassign rules; active Staff/Admin accepted; Requester, inactive, missing, and wrong-role assignees rejected without partial change; a same-assignee retry stays read-only after that assignee is deactivated. | server/tests/lab-04/actions-taken.api.test.ts | Passed locally; 2026-10-29 |
| API-04 | API/validation | AC-04, AC-06 | Edit boundaries, conditional follow-up, attachment-note length/plain-text behavior, result validation, event snapshots, and Action version increment. | server/tests/lab-04/actions-taken.api.test.ts | Passed locally; 2026-10-29 |
| API-05 | API/workflow | AC-05, AC-11, AC-16 | Start/complete/cancel transitions, required completion Result, terminal behavior, repeat calls, and no partial event on rejection. | server/tests/lab-04/actions-taken.api.test.ts | Passed locally; 2026-10-29 |
| API-06 | API/history | AC-10, AC-12 | Ticket status events are append-only, actor/from/to/time are correct, equal timestamps have stable ID order, and Requesters see only own history. | server/tests/lab-04/ticket-workflow.api.test.ts | Passed locally; 2026-10-30 |
| API-07 | API/workflow | AC-10, AC-11 | All 64 current/next status pairs are tested for IT Staff, Administrator, and Requester; support follows the matrix and Requester writes are forbidden. | server/tests/lab-04/ticket-workflow.api.test.ts | Passed locally; 2026-10-30 |
| API-08 | API/concurrency | AC-11, AC-16 | Resolution/cancellation gates are server-enforced; Action creation and Ticket resolution share a lock; competing status writes return one stale 409; rejected writes change no state. | server/tests/lab-04/ticket-workflow.api.test.ts | Passed locally; 2026-10-30 |
| API-09 | API/regression | AC-11 | Requester resolution indication remains advisory, first timestamp stable, forbidden statuses reject; reopening clears signal without deleting history. | server/tests/lab-04/ticket-workflow.api.test.ts; server/tests/lab-03/requester-regression.api.test.ts; e2e/lab-04/ticket-resolution.spec.ts | Passed locally; 2026-10-30 |
| API-10 | API/dashboard | AC-08 | Requester counts/lists match fixture queries and Bangkok date boundaries; foreign Requester data never appears; zero metrics and drill-down filters/sorts (`statusGroup`, `updatedAfter`, `resolvedAfter`, `resolvedAt`) are exact, including legacy Tickets without status events. | server/tests/lab-04/requester-dashboard.api.test.ts | Passed locally; 2026-10-30 |
| API-11 | API/dashboard | AC-09 | Staff/Admin counts and lists match real DB queries, correct status/priority ordering, empty states, safe Requester `{id,name}` summaries without email, and Queue filters/sorts (`statusGroup`, `updatedAfter`, `itPriorityGroup`, `urgentWork`). | server/tests/lab-04/staff-dashboard.api.test.ts | Passed locally; 2026-10-30 |
| API-15 | API/dashboard | AC-19 | Staff/Admin Actions Taken count matches a direct database count for the authenticated `performedById`; recent five are performer-scoped, exclude Actions merely assigned to the user, sort actionAt/id descending, and include safe Ticket drill-down DTOs. | server/tests/lab-04/staff-dashboard.api.test.ts | Passed; 2026-11-01 |
| API-12 | API/safe failure | AC-15, AC-16 | Missing Ticket/Action, forbidden role, malformed input, stale versions, and DB failure produce safe status/error shape with no leaked internals. | server/tests/lab-04/actions-taken.api.test.ts; server/tests/lab-04/ticket-workflow.api.test.ts; server/tests/lab-04/requester-dashboard.api.test.ts; server/tests/lab-04/staff-dashboard.api.test.ts | Action/Ticket safe failures passed locally; dashboards return generic errors without internals; 2026-10-30 |
| API-13 | API/workflow invariant | AC-11, AC-16 | Parameterize Action create/edit/assignment/status requests over RESOLVED, CLOSED, and CANCELLED parent Tickets; each returns 409 `ACTION_TICKET_NOT_MUTABLE` with no Action, ActionEvent, version, timestamp, or workflowVersion change. Use a directly inserted PLANNED Action fixture where needed to exercise the parent guard before Action-state validation. Legal reopen restores eligibility; CANCELLED remains blocked. An exact same-key/actor/Ticket/payload create replay after a parent status change returns the original result without writing. | server/tests/lab-04/actions-taken.api.test.ts | Passed locally; 2026-10-30 |
| API-14 | API/read contract | AC-01, AC-12 | GET Actions orders by actionAt ascending and Action ID ascending using controlled IDs/timestamps, including equal timestamps; support records include per-Action events ordered by createdAt/event ID, including equal-time ties, while Requester records have no events or snapshots. | server/tests/lab-04/actions-taken.api.test.ts | Passed locally; 2026-10-29 |
| PERF-01 | Performance smoke | AC-09 | With 1,000 Tickets and 5,000 Actions, dashboard responses remain summary-only (≤10 rows/list) and p95 is below 500 ms over 20 warmed reads per role; record environment and counts. | server/tests/lab-04/dashboard-performance-smoke.test.ts | Passed; Node 22.18.0; Requester p95 11.7 ms; Staff p95 18.4 ms; 2026-10-30 |
| UI-01 | UI component | AC-09, AC-15 | Staff/Admin dashboard cards, distributions, recent/urgent links with exact Queue query filters/sorts, active filter labels, loading/empty/forbidden/failure states. | client/tests/lab-04/StaffDashboard.test.tsx; client/tests/lab-04/StaffQueue.test.tsx | Passed locally; 2026-10-30 |
| UI-08 | UI component | AC-19, AC-15 | My Actions Taken count and recent Action rows link to the correct parent Ticket; completed/in-progress status labels and explicit zero/empty state render accessibly. | client/tests/lab-04/StaffDashboard.test.tsx | Passed; 2026-11-01 |
| UI-02 | UI component | AC-08, AC-15 | Requester-owned metrics/recent lists, zero states, exact My Tickets query filters/sorts and active labels, accessible links, forbidden/failure states, no requester ID from the URL. | client/tests/lab-04/RequesterDashboard.test.tsx; client/tests/lab-04/MyTickets.test.tsx | Passed locally; 2026-10-30 |
| UI-03 | UI component | AC-02, AC-06, AC-15 | Action create/read layout, auto performer, field validation, conditional note, Attachment Notes without upload control, retained draft on failure. | client/tests/lab-04/ActionsTaken.test.tsx | Passed locally; 2026-10-30 |
| UI-04 | UI/authz | AC-03, AC-07 | Assignee options/rejection, Requester read-only view, hidden controls plus API denial feedback. | client/tests/lab-04/ActionsTaken.test.tsx | Passed locally; 2026-10-30 |
| UI-05 | UI/component | AC-04, AC-16 | Action edit, version conflict refresh, draft retention, safe error, busy behavior, explicit Bangkok timestamp conversion, and preservation of seconds on untouched timestamps. | client/tests/lab-04/ActionsTaken.test.tsx | Passed locally; 2026-10-30 |
| UI-06 | UI/workflow | AC-05, AC-11 | Action Start/Complete/Cancel controls, result required, terminal state, confirmation/cancel behavior, parent refresh. | client/tests/lab-04/ActionsTaken.test.tsx | Passed locally; 2026-10-30 |
| UI-07 | UI/workflow | AC-10, AC-11, AC-12 | Ticket permitted transitions, gate feedback/focus, ordered read-only status history, requester role visibility. | client/tests/lab-04/TicketWorkflow.test.tsx | Passed locally; 2026-10-30 |
| STYLE-01 | Style/accessibility | AC-15, AC-17 | Zen Green dashboard cards, semantic metric links, text status/priority badges, loading and alert roles, route heading focus. | client/tests/lab-04/ZenGreen.test.tsx; e2e/lab-04/dashboards.spec.ts | Passed locally; 2026-10-30 |
| RESP-01 | Responsive | AC-17, AC-19 | Dashboard cards/lists and My Actions Taken at 1440×1000, 820×1180, 390×844 and 767/768/991/992; no page overflow and correct grid columns. | e2e/lab-04/dashboards.spec.ts | Passed; 2026-11-01; screenshots refreshed |
| E2E-01 | E2E/security | AC-02–AC-07, AC-15, AC-16 | Requester read-only access; Staff creates, assigns, edits, starts, completes, and cancels Actions; inactive-assignee rejection preserves the draft; UTC browser submits Asia/Bangkok time with +07:00; responsive screenshots have no horizontal overflow. | e2e/lab-04/actions-taken-flow.spec.ts | Passed locally; 2026-10-30 |
| E2E-02 | E2E/workflow | AC-10–AC-12, AC-16 | Full Ticket status path, resolution/cancellation gates, append-only history/order, requester advisory signal, role visibility, and responsive screenshots. | e2e/lab-04/ticket-resolution.spec.ts | Passed locally; 2026-10-30 |
| E2E-03 | E2E/dashboard | AC-08, AC-09, AC-17, AC-19 | Requester/Staff role navigation, keyboard metric drill-downs, operational links, current-user Actions visibility, responsive dashboard screenshots and layout checks. Component tests cover zero and safe-error states; dashboard API tests cover performer isolation. | e2e/lab-04/dashboards.spec.ts | Passed; 2026-11-01 |
| REG-01 | Regression | AC-18 | Existing authenticated and Lab 1/2/3 server/client suites keep passing for login, ownership, Ticket, attachments, comments, notes, user management. | Existing server/tests/lab-01..lab-03 and client/tests/lab-01..lab-03 paths | Passed in full server/client/E2E runs; 2026-10-30 |
| VIS-01 | Visual/manual | AC-15, AC-17 | Inspect required screenshots for readable text, focus, breakpoints, no overlap/clipping, no unfinished controls; record each viewport/result. | artifacts/lab-04/screenshots/{staff-dashboard,requester-dashboard,actions-taken,ticket-workflow}/ | Passed; all 19 dashboard, Actions, and workflow captures inspected; refreshed Staff screenshots show My Actions Taken; 2026-11-01 |
| REL-01 | Release verification | AC-18, AC-19 | Verify final-main baseline, then rerun full checks for the Part 5 rubric addendum and record its review/merge state accurately. | docs/lab-04/tests.md and final-main PR evidence | Main baseline passed in PR #85; Part 5 addendum checks passed in this working copy, pending peer review/merge |

## 2. Acceptance Criterion Traceability

| Acceptance Criterion | Planned tests |
|---|---|
| AC-01 | UNIT-01, API-01, API-14 |
| AC-02 | API-02, UI-03, E2E-01 |
| AC-03 | API-03, UI-04, E2E-01 |
| AC-04 | UNIT-01, API-04, UI-05 |
| AC-05 | UNIT-02, API-05, UI-06, E2E-01 |
| AC-06 | UNIT-01, API-04, UI-03 |
| AC-07 | API-01, API-03, UI-04, E2E-01 |
| AC-08 | API-10, UI-02, E2E-03 |
| AC-09 | API-11, PERF-01, UI-01, E2E-03 |
| AC-10 | UNIT-02, API-06, API-07, UI-07, E2E-02 |
| AC-11 | API-08, API-09, API-13, UI-06, UI-07, E2E-02 |
| AC-12 | API-01, API-06, API-14, UI-07, E2E-02 |
| AC-13 | MIG-01, MIG-02 |
| AC-14 | SEED-01, API-10, API-11 |
| AC-15 | API-12, UI-01, UI-02, UI-03, STYLE-01, VIS-01 |
| AC-16 | API-02, API-03, API-08, API-12, API-13, UI-05, E2E-01, E2E-02 |
| AC-17 | STYLE-01, RESP-01, VIS-01, E2E-03 |
| AC-18 | REG-01, REL-01 |
| AC-19 | API-15, UI-08, RESP-01, E2E-03 |

## 3. Responsive and Accessibility Checklist

| Check | Evidence | Final status |
|---|---|---|
| Requester dashboard | Desktop/tablet/mobile; own data, empty/zero/recent/resolved states | Passed at 1440×1000, 820×1180, and 390×844; breakpoint edges 767/768/991/992 passed; screenshots captured and visually inspected 2026-10-30 |
| Staff/Admin dashboard | Desktop/tablet/mobile; counts, My Actions Taken, drill-down, urgent list, safe failure | My Actions count and latest five visible at 1440×1000, 820×1180, and 390×844; responsive E2E passed; 2026-11-01 |
| Actions Taken | List/create/edit/assignment/transition/complete/cancel, validation/conflict, read-only Requester | Passed at 1440×1000, 820×1180, and 390×844; Playwright confirmed no horizontal overflow on 2026-10-30 |
| Ticket workflow/history | Confirmations, resolution/cancellation gates, ordered history, requester advisory signal | Passed at 1440×1000, 820×1180, and 390×844; Playwright confirmed no horizontal overflow on 2026-10-30 |
| Keyboard and semantics | Tab order, visible focus, labels/errors, dialog focus trap/Escape/restore, status/alert announcements | Dashboard heading receives route focus; metric links work by keyboard; loading, forbidden, and failure states use status/alert roles; dashboard keyboard checks passed 2026-10-30 |
| Layout | 1440×1000, 820×1180, 390×844 and 767/768/991/992 boundaries; no clipping/overlap/page overflow | Dashboard Playwright checks passed at all listed widths on 2026-10-30; no horizontal overflow |

## 4. Final Verification Commands

Run from the repository root. Isolated PostgreSQL commands require
`TEST_DATABASE_URL` to end in `_test`; they create and drop temporary schemas
inside that disposable database. Do not run destructive migration/reset
commands against the populated development database.

~~~bash
rtk npm run test:isolated --prefix server -- --maxWorkers=1 --minWorkers=1
rtk npm run build --prefix server
rtk npm test --prefix client -- --reporter=dot
rtk npm run build --prefix client
rtk npm run test:e2e:isolated --prefix server
rtk git diff --check
~~~

The client Playwright config discovers the required root `e2e/lab-04/` suites
and retains `client/e2e/lab-02/` and `client/e2e/lab-03/`. PR #85 is the merged
main baseline. The current-user Actions dashboard follow-up is a working-copy
addendum; its checks do not claim that the feature has already merged to main.

## 5. Results Log

- Part 5 rubric addendum verification on 2026-11-01, in the current working
  copy after PR #85 merged:
  - `rtk npm run test:isolated --prefix server -- --maxWorkers=1 --minWorkers=1`:
    **34 files passed; 149 tests passed; 0 failed; 0 skipped**. This includes
    direct Prisma count comparisons, performer-versus-assignee isolation,
    recent-five ordering, Admin scope, and empty-state coverage.
  - Performance smoke on 1,000 Tickets and 5,000 Actions: Requester p95
    **10.1 ms**; Staff/Admin p95 **25.7 ms** (20 warmed reads per role).
  - `rtk npm test --prefix client -- --reporter=dot`: **20 files passed; 69
    tests passed; 0 failed**.
  - `rtk npm run build --prefix server`, `rtk npm run build --prefix client`,
    and `rtk git diff --check`: passed.
  - `rtk npm run test:e2e:isolated --prefix server`: **12 tests passed; 0
    failed; 0 skipped** across Labs 2–4. The Staff dashboard scenario asserts
    the non-zero current-user count and Action link; responsive checks include
    1440, 820, 390, 767, 768, 991, and 992 pixels.
  - The refreshed dashboard captures are under
    `artifacts/lab-04/screenshots/staff-dashboard/`. The 1440×1000, 820×1180,
    and 390×844 screenshots were visually inspected; each shows the current
    user's count and up to five recent Actions. Playwright reported no page
    horizontal overflow.
  - This addendum is verified locally and still requires peer review and merge
    before it can be claimed as part of `main`.

- PR #85 final-main baseline verification on 2026-10-31, from merge commit
  `ae4dfd3cf90024a676bceafc426b019d1265124d`:
  - Server: **34 files, 149 tests passed**; Client: **20 files, 69 tests
    passed**; Server and Client builds passed; isolated Playwright: **12 tests
    passed**. See [PR #85](https://github.com/jarbbie/toktickit/pull/85).

- Historical Issue #74 integration verification on 2026-10-30, on the hardening branch:
  - `rtk npm run test:isolated --prefix server -- --maxWorkers=1 --minWorkers=1`:
    **34 files passed; 149 tests passed; 0 failed; 0 skipped**. This includes
    the inherited Labs 1–3 server regressions, populated migration and recovery,
    seed/API coverage, the new Action validation and transition unit tests, and
    the performance smoke test.
  - Performance smoke used 1,000 Tickets and 5,000 Actions, with 20 warmed reads
    per role on Node 22.18.0. Requester dashboard p95 was **11.7 ms** and Staff
    dashboard p95 was **18.4 ms**. Both response sets were summary-only and
    below the 500 ms threshold.
  - `rtk npm run build --prefix server`: passed. The full client suite passed:
    **20 files; 69 tests; 0 failures**. `rtk npm run build --prefix client`:
    passed.
  - `rtk npm run test:e2e:isolated --prefix server`: **12 tests passed; 0
    failed; 0 skipped** across Labs 2–4. The first run exposed three outdated
    inherited Lab 3 expectations: the Requester home is now Dashboard, and a
    Ticket must have a completed Action before resolution. Updated those checks
    and reran the complete suite successfully.
  - The dashboard E2E was then rerun on a clean seed to capture final dashboard
    screenshots and verify keyboard drill-downs, 1440×1000, 820×1180, 390×844,
    and 767/768/991/992 breakpoints. The browser audit found no page errors,
    unexpected console errors, or visible TODO/TBD/coming-soon/placeholder copy;
    the only 401 responses were the expected unauthenticated `/api/auth/me`
    probes.
  - Visually inspected all 19 dashboard, Actions Taken, and Ticket workflow
    captures across desktop, tablet, and mobile. Text and controls remain
    readable, with no observed overlap or clipping; Playwright reported no
    horizontal overflow.
  - Playwright discovery lists **12 tests in 10 files**, retaining the Lab 2
    and Lab 3 suites under `client/e2e/` and finding the required Lab 4 suites
    under root `e2e/lab-04/`.
  - The isolated runner used the existing `toktickit-postgres` container and a
    temporary schema in the disposable `toktickit_test` database. It did not
    use the populated development schema. These are historical Issue #74
    results, not the final Part 5 amendment run.

- Issue #68 verification on 2026-10-28: PR source at
  `0ddcdc410775849b43a98526b57722769e7be1be` plus the SQL-helper and legacy
  fixture corrections committed with this result.
- `rtk npm test -- tests/lab-02/database-seed.test.ts tests/lab-04` from
  `server/`: **5 files passed; 7 tests passed; 0 failed; 0 skipped**. This
  includes populated migration, migration rollback/retry, all three seed
  integration cases, seed mocks, and the test-database URL guard.
- The PostgreSQL cases ran against the separate `toktickit_test` database in
  the existing local PostgreSQL container. Each case created and removed its
  own temporary schema. Host access was required for the local Docker service.
- The first database run exposed a helper that split function bodies at
  internal semicolons and a raw legacy Ticket insert without `updatedAt`.
  Both test setup defects were corrected before the passing run.
- `rtk npm run build` from `server/`: passed after the corrections.
  `rtk git diff --check`: passed. These are focused PR checks, not a full-suite
  or final-main verification.
- Issue #69 verification on 2026-10-29, based on the merged #68 source at
  `e69876082410ea4601198c71bfc9d03df9385f08` plus the Action API and test
  changes committed with this entry:
  - Red: 13 PostgreSQL API cases failed with missing-route 404 responses before
    implementation (after starting the existing PostgreSQL container).
  - Green: 16 Action API cases passed, covering role/session/Origin gates,
    ownership concealment, ordered safe reads, active assignees, validation,
    lifecycle pairs, concurrency, exact retries, terminal parents, and rollback.
  - Review regression: retrying the current assignment after the assignee was
    deactivated returns 200 and leaves Ticket, Action, and event state unchanged;
    assigning a different inactive account still returns 409.
  - `rtk npm run test:isolated` from `server/`: **28 files passed, 125 tests
    passed, 0 failed, 0 skipped**, including inherited Labs 1–3 cases.
  - `rtk npm run build` from `server/`: passed. `rtk git diff --check`: passed.
  - The isolated runner provisions a migrated schema under `TEST_DATABASE_URL`
    and supplies it as the test child process's `DATABASE_URL`; inherited
    database tests can therefore run without the development database.
  - Ticket status transitions, gates, and history API were completed in Issue
    #71; Action mutations use the same Ticket advisory lock.
- Issue #70 Actions Taken UI verification on 2026-10-30, based on merged PR #78
  (`33b0a05600b38fa5fa24a9d2d4db1953a5170484`):
  - `rtk npm test --prefix client`: **14 files passed; 50 tests passed**.
  - `rtk npm run build --prefix client` and `rtk npm run build --prefix server`:
    passed.
  - The isolated Actions Taken E2E flow passed **3 tests**, covering Requester
    read-only display, support create/assign/edit/start/complete/cancel, an
    account deactivated during form entry, and a UTC browser submitting the
    selected time with the explicit Asia/Bangkok `+07:00` offset. The rejected
    save kept the draft, refreshed active assignees, and succeeded after
    selecting an active user.
    The runner migrated, seeded, and dropped a temporary schema in the existing
    `toktickit_test` database; it did not use the development schema.
  - The test generated and visually checked responsive captures under
    `artifacts/lab-04/screenshots/actions-taken/` (desktop, tablet, mobile for
    both roles, plus the support audit-history view). All three sizes passed the
    page horizontal-overflow check. The seven PNG captures are included in PR
    #79; rerunning the E2E command recreates them.
  - Review follow-up: the form now initializes and submits Action dates in
    Asia/Bangkok independently of browser timezone. Editing another field omits
    an untouched date from the patch, preserving stored seconds. The regression
    test uses an Action timestamp with non-zero seconds.
- Issue #71 Ticket workflow verification on 2026-10-30, based on merged PR #79
  (`25fa17dc136e9ddb17e633b3a401e32307987e99`) and the workflow increment:
  - `rtk npm run test:isolated --prefix server`: **29 files passed; 131 tests
    passed; 0 failed; 0 skipped**, including all 64 status pairs across IT
    Staff, Administrator, and Requester, gate and stale-write behavior, the
    shared Action/resolution lock, history access, and inherited Lab 1–3 server
    regressions.
  - `rtk npm test --prefix client`: **15 files passed; 54 tests passed**.
  - `rtk npm run build --prefix server` and `rtk npm run build --prefix client`:
    passed. `rtk git diff --check`: passed.
  - `rtk npm run test:e2e:isolated --prefix server --
    lab-04/ticket-resolution.spec.ts`: **1 test passed**. It covered the full
    status path, resolution and cancellation gates, completed Actions, Requester
    advisory feedback, and read-only status history. The isolated runner used a
    temporary schema in `toktickit_test` and separate API/client ports so it
    did not reuse the existing development server.
  - Six desktop/tablet/mobile screenshots for Staff and Requester are under
    `artifacts/lab-04/screenshots/ticket-workflow/`; Playwright checked each
    viewport for horizontal overflow. Desktop and mobile captures were visually
    inspected for both roles.
  - Review follow-up: a stale status target remains visible as a disabled
    option after refresh, and the UI prevents resubmission unless the target is
    still permitted. Status-update and history responses set `Cache-Control:
    no-store` before authentication or handler processing, including errors;
    regressions cover stale UI state and 409, 404, and 401 responses.
- Issue #72 Dashboard API verification on 2026-10-30, based on `lab4-staging`
  commit `4b0cd0ba3e881889104973cf9f6a7e2397e9f8c3`:
  - `rtk npm run test:isolated --prefix server -- --maxWorkers=1 --minWorkers=1`:
    **31 files passed; 137 tests passed; 0 failed; 0 skipped**, including
    dashboard authorization, metrics, Bangkok calendar windows,
    resolution-event ordering, zero results, safe failures, drill-down filters,
    and inherited Labs 1–3 regressions.
  - `rtk npm run build --prefix server` and `rtk git diff --check`: passed.
  - Requester dashboard tests verify owner-only counts and rows, latest
    resolution timestamps, legacy Tickets without status history, and exact
    inclusive list filters. Staff/Admin tests verify all-status and open-work
    counts, urgency ordering, owner summaries without email, and matching Queue
    populations.
- Issue #73 Dashboard UI verification on 2026-10-30, against `lab4-staging`
  commit `b3ce566e8af3909b37b1ede8b03740094608f0c6`, implementation commit
  `eade9b68eee2602a128b9a5a58ec777ff631ddbf`:
  - `rtk npm test --prefix client -- --reporter=dot`: **20 files passed; 69
    tests passed; 0 failed**. This includes Requester and Staff/Admin dashboard
    states, exact drill-down filters, existing Lab 1–3 client regressions, and
    the updated change-password return route to `/dashboard`.
  - `rtk npm run build --prefix client` and `rtk git diff --check`: passed.
  - PR #82 review follow-up: Resolved At stays newest-first after header clicks
    and exposes the fixed order accessibly; Urgent Work disables the direction
    selector and omits direction from its API request; a delayed dashboard-to-
    Ticket Detail navigation focuses the heading once the Ticket loads.
  - The dashboard Playwright command below ran on original PR head
    `0d168af8f52890928605e815ed243d244753f58d`, before the review follow-up; it
    remains baseline evidence.
  - `rtk npm run test:e2e:isolated --prefix server --
    lab-04/dashboards.spec.ts`: **1 test passed** against the disposable
    `_test` schema. Keyboard metric activation, role navigation, Queue/My
    Tickets filters, viewport layouts at 1440, 820, 390, 767, 768, 991, and
    992 pixels, and no horizontal overflow passed.
  - Six responsive screenshots were captured and inspected under
    `artifacts/lab-04/screenshots/{requester-dashboard,staff-dashboard}/`.
    Each role has desktop (1440×1000), tablet (820×1180), and mobile (390×844)
    captures.
- Historical Issue #74 unit, performance, regression, and visual results are
  retained above. They are distinct from the final-main PR #85 baseline and the
  2026-11-01 Part 5 addendum run.
- Baseline results: refer to the historical Lab 3 evidence in docs/lab-03;
  those results are not a new Lab 4 run.
