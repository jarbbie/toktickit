# Lab 4 Test-Driven Development and Traceability Plan

**Status:** Data-foundation tests (#68), Actions Taken API tests (#69), and the
Actions Taken Ticket Detail UI for #70 are implemented. PostgreSQL tests
require a disposable `TEST_DATABASE_URL` whose database name ends in `_test`;
remaining Lab 4 work is still planned.

TDD loop: add a focused failing test → record the red result → implement the
smallest approved change → run focused and inherited regressions → record the
actual green result and commit. Contract changes update specification, API/UI,
and this matrix before implementation continues.

## 1. Planned Test Matrix

| Test ID | Type | ACs | What it proves / expected result | Planned path | Status |
|---|---|---|---|---|---|
| UNIT-01 | Unit | AC-01, AC-04, AC-06 | Action text/date/follow-up validation accepts boundaries and rejects invalid values; false follow-up clears current note. | server/tests/lab-04/action-rules.test.ts | Planned |
| UNIT-02 | Unit | AC-05, AC-10, AC-11 | Every Action/Ticket transition pair agrees with documented matrices; same/terminal transitions reject. | server/tests/lab-04/workflow-rules.test.ts | Planned |
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
| API-06 | API/history | AC-10, AC-12 | Ticket status events are append-only, actor/from/to/time are correct, equal timestamps have stable ID order, and Requesters see only own history. | server/tests/lab-04/ticket-workflow.api.test.ts | Planned |
| API-07 | API/workflow | AC-10, AC-11 | All eight Ticket statuses × all roles: allowed transitions succeed; disallowed, same-state, and Requester attempts reject. | server/tests/lab-04/ticket-workflow.api.test.ts | Planned |
| API-08 | API/concurrency | AC-11, AC-16 | Resolution/cancellation gates are server-enforced; Action creation/follow-up and Ticket resolve races serialize; stale workflow version returns 409 and writes nothing. | server/tests/lab-04/ticket-workflow.api.test.ts | Planned |
| API-09 | API/regression | AC-11 | Requester resolution indication remains advisory, first timestamp stable, forbidden statuses reject; reopening clears signal without deleting history. | server/tests/lab-04/ticket-workflow.api.test.ts; server/tests/lab-03/requester-regression.api.test.ts | Planned |
| API-10 | API/dashboard | AC-08 | Requester counts/lists match fixture queries and Bangkok date boundaries; foreign Requester data never appears; zero metrics and drill-down filters/sorts (`statusGroup`, `updatedAfter`, `resolvedAfter`, `resolvedAt`) are exact, including legacy Tickets without status events. | server/tests/lab-04/requester-dashboard.api.test.ts; server/tests/lab-04/requester-list.api.test.ts | Planned |
| API-11 | API/dashboard | AC-09 | Staff/Admin counts and lists match real DB queries, correct status/priority ordering, empty states, safe Requester `{id,name}` summaries without email, and Queue filters/sorts (`statusGroup`, `updatedAfter`, `itPriorityGroup`, `urgentWork`). | server/tests/lab-04/staff-dashboard.api.test.ts; server/tests/lab-04/staff-queue.api.test.ts | Planned |
| API-12 | API/safe failure | AC-15, AC-16 | Missing Ticket/Action, forbidden role, malformed input, stale versions, and DB failure produce safe status/error shape with no leaked internals. | server/tests/lab-04/actions-taken.api.test.ts; server/tests/lab-04/safe-errors.api.test.ts | Action API passed; remaining workflow scope in #70 |
| API-13 | API/workflow invariant | AC-11, AC-16 | Parameterize Action create/edit/assignment/status requests over RESOLVED, CLOSED, and CANCELLED parent Tickets; each returns 409 `ACTION_TICKET_NOT_MUTABLE` with no Action, ActionEvent, version, timestamp, or workflowVersion change. Use a directly inserted PLANNED Action fixture where needed to exercise the parent guard before Action-state validation. Legal reopen restores eligibility; CANCELLED remains blocked. An exact same-key/actor/Ticket/payload create replay after a parent status change returns the original result without writing. | server/tests/lab-04/actions-taken.api.test.ts | Action API passed; remaining workflow scope in #70 |
| API-14 | API/read contract | AC-01, AC-12 | GET Actions orders by actionAt ascending and Action ID ascending using controlled IDs/timestamps, including equal timestamps; support records include per-Action events ordered by createdAt/event ID, including equal-time ties, while Requester records have no events or snapshots. | server/tests/lab-04/actions-taken.api.test.ts | Passed locally; 2026-10-29 |
| PERF-01 | Performance smoke | AC-09 | With 1,000 Tickets and 5,000 Actions, dashboard responses remain summary-only (≤10 rows/list) and p95 is below 500 ms over 20 local warmed reads; record environment and counts. | server/tests/lab-04/dashboard-performance-smoke.test.ts | Planned |
| UI-01 | UI component | AC-09, AC-15 | Staff/Admin dashboard cards, distributions, recent/urgent links with exact Queue query filters/sorts, active filter labels, loading/empty/forbidden/failure states. | client/tests/lab-04/StaffDashboard.test.tsx; client/tests/lab-04/StaffQueue.test.tsx | Planned |
| UI-02 | UI component | AC-08, AC-15 | Requester-owned metrics/recent lists, zero states, exact My Tickets query filters/sorts and active labels, accessible links, forbidden/failure states, no foreign data. | client/tests/lab-04/RequesterDashboard.test.tsx; client/tests/lab-04/MyTickets.test.tsx | Planned |
| UI-03 | UI component | AC-02, AC-06, AC-15 | Action create/read layout, auto performer, field validation, conditional note, Attachment Notes without upload control, retained draft on failure. | client/tests/lab-04/ActionsTaken.test.tsx | Passed locally; 2026-10-30 |
| UI-04 | UI/authz | AC-03, AC-07 | Assignee options/rejection, Requester read-only view, hidden controls plus API denial feedback. | client/tests/lab-04/ActionsTaken.test.tsx | Passed locally; 2026-10-30 |
| UI-05 | UI/component | AC-04, AC-16 | Action edit, version conflict refresh, draft retention, safe error and one-request busy behavior. | client/tests/lab-04/ActionsTaken.test.tsx | Passed locally; 2026-10-30 |
| UI-06 | UI/workflow | AC-05, AC-11 | Action Start/Complete/Cancel controls, result required, terminal state, confirmation/cancel behavior, parent refresh. | client/tests/lab-04/ActionsTaken.test.tsx | Passed locally; 2026-10-30 |
| UI-07 | UI/workflow | AC-10, AC-11, AC-12 | Ticket permitted transitions, gate feedback/focus, ordered read-only status history, requester role visibility. | client/tests/lab-04/TicketWorkflow.test.tsx | Planned |
| STYLE-01 | Style/accessibility | AC-15, AC-17 | Zen Green tokens, labels, semantic alerts, status text cues, visible focus, dialogs, long text, disabled/busy controls. | client/tests/lab-04/ZenGreen.test.tsx | Planned |
| RESP-01 | Responsive | AC-17 | Major dashboards, Actions, workflow screens at 1440×1000, 820×1180, 390×844 and 767/768/991/992; no clipping/overlap/page overflow. | client/tests/lab-04/responsive-accessibility.test.tsx | Planned |
| E2E-01 | E2E/security | AC-02–AC-07, AC-15, AC-16 | Requester read-only access; Staff creates, assigns, edits, starts, completes, and cancels Actions; inactive-assignee rejection preserves the draft; responsive screenshots have no horizontal overflow. | client/e2e/lab-04/actions-taken-flow.spec.ts | Passed locally; 2026-10-30 |
| E2E-02 | E2E/workflow | AC-10–AC-12, AC-16 | Full Ticket status path, resolution gate bypass attempt, append-only history/order, requester advisory signal, role visibility. | e2e/lab-04/ticket-resolution.spec.ts | Planned |
| E2E-03 | E2E/dashboard | AC-08, AC-09, AC-17 | Requester isolation, Staff/Admin metrics/drill-down, non-zero and zero data, error state, responsive dashboard screenshots. | e2e/lab-04/dashboards.spec.ts | Planned |
| REG-01 | Regression | AC-18 | Existing authenticated and Lab 1/2/3 server/client suites keep passing for login, ownership, Ticket, attachments, comments, notes, user management. | Existing server/tests/lab-01..lab-03 and client/tests/lab-01..lab-03 paths | Planned |
| VIS-01 | Visual/manual | AC-15, AC-17 | Inspect required screenshots for readable text, focus, breakpoints, no overlap/clipping, no unfinished controls; record each viewport/result. | artifacts/lab-04/screenshots/{staff-dashboard,requester-dashboard,actions-taken,ticket-workflow}/ | Planned |
| REL-01 | Release verification | AC-18 | Re-run full tests/builds/migration/seed/E2E from exact final main commit and link output in nine-part PDF. | docs/lab-04/tests.md and final-main CI/terminal evidence | Planned |

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

## 3. Responsive and Accessibility Checklist

| Check | Evidence | Final status |
|---|---|---|
| Requester dashboard | Desktop/tablet/mobile; own data, empty/zero/recent/resolved states | Planned |
| Staff/Admin dashboard | Desktop/tablet/mobile; counts, drill-down, urgent list, safe failure | Planned |
| Actions Taken | List/create/edit/assignment/transition/complete/cancel, validation/conflict, read-only Requester | Passed at 1440×1000, 820×1180, and 390×844; Playwright confirmed no horizontal overflow on 2026-10-30 |
| Ticket workflow/history | Confirmations, resolution gate, ordered history, requester advisory signal | Planned |
| Keyboard and semantics | Tab order, visible focus, labels/errors, dialog focus trap/Escape/restore, status/alert announcements | Planned |
| Layout | 1440×1000, 820×1180, 390×844 and 767/768/991/992 boundaries; no clipping/overlap/page overflow | Planned |

## 4. Planned Final Commands

Run after implementation on the isolated Lab 4 test database, then from final
main. Do not run destructive migration/reset commands against the populated
development database.

~~~bash
rtk npm test --prefix server
rtk npm run build --prefix server
rtk npm test --prefix client
rtk npm run build --prefix client
rtk npm run test:e2e:isolated --prefix server
rtk git diff --check
~~~

The existing client Playwright config must discover the required root
e2e/lab-04 suites and keep client/e2e/lab-02 and client/e2e/lab-03 regression
suites. Add actual test result date, exact commit, pass/fail/skipped counts, and
any limitation to this file only after those commands are run.

## 5. Results Log

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
  - Ticket status transitions, gates, and history API remain Issue #70 work;
    Action mutations already acquire the inherited Ticket status advisory lock.
- Issue #70 Actions Taken UI verification on 2026-10-30, based on merged PR #78
  (`33b0a05600b38fa5fa24a9d2d4db1953a5170484`):
  - `rtk npm test --prefix client`: **14 files passed; 49 tests passed**.
  - `rtk npm run build --prefix client` and `rtk npm run build --prefix server`:
    passed.
  - The isolated Actions Taken E2E flow passed **2 tests**, covering Requester
    read-only display, support create/assign/edit/start/complete/cancel, and an
    account deactivated during form entry. The rejected save kept the draft,
    refreshed active assignees, and succeeded after selecting an active user.
    The runner migrated, seeded, and dropped a temporary schema in the existing
    `toktickit_test` database; it did not use the development schema.
  - The test generated and visually checked responsive captures under
    `artifacts/lab-04/screenshots/actions-taken/` (desktop, tablet, mobile for
    both roles, plus the support audit-history view). All three sizes passed the
    page horizontal-overflow check. The PNGs remain local to this run and are
    not included in the PR; rerunning the E2E command recreates them.
- Other Lab 4 test rows remain planned as marked in the matrix.
- Lab 4 product verification: not started.
- Baseline results: refer to the historical Lab 3 evidence in docs/lab-03;
  those results are not a new Lab 4 run.
