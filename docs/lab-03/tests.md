# Lab 3 Test Plan and Traceability

## 1. Pre-Implementation Strategy

This plan is written with the engineering contract before Lab 3 implementation.
Every row is `Planned`: its file is the intended actual repository path, not a
claim that it already exists or passes. Implement behavioral tests before the
corresponding feature, observe the expected failure, then implement and verify.
When a row passes, record its actual file, command, result, and commit; do not
copy earlier Lab 2 results into Lab 3 completion evidence.

Use Vitest for unit tests, Vitest/Supertest for Express API tests, React Testing
Library for components, and Playwright for browser flows and responsive/style
evidence. Real PostgreSQL tests are required for migration, normalized uniqueness,
session revocation, atomic claims, attachment count limits, and account/assignment
concurrency; mocked calls alone cannot prove these invariants. Use isolated local
test databases and upload directories, never reset the user's working database.

Fixtures include Requester A/B, active and inactive accounts in each applicable
role, initial-password and changed-password accounts, multiple staff owners,
two active Administrators for concurrent safety tests, all eight statuses, both
priority values, assigned/unassigned tickets, and active/removed Attachments.
Use disposable local credentials and a controlled clock for expiry/throttling.
All cookie-authenticated unsafe test requests send the configured Origin unless
the case intentionally tests origin rejection.

## 2. Planned Test Rows

| ID | Type | Requirement / AC | What it tests | Expected result | Planned actual test file | Status |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-03, BR-04; AC-04, AC-05 | Email normalization; untrimmed password lengths 11/12/128/129, equality, hashing parameters and salt behavior | Boundary/reuse validation is exact; configured Argon2id verifies correct input and hashes differ by salt | `server/tests/lab-03/password.test.ts` | Planned |
| UNIT-02 | Unit | BR-05, BR-06; AC-05, AC-06 | Token generation/hash and fixed session expiry with clock at just before/at eight hours | Sufficient random token; only SHA-256 hash persisted; no sliding lifetime | `server/tests/lab-03/session.test.ts` | Planned |
| UNIT-03 | Unit | BR-08; AC-02 | Normalized-email/IP key, fifth/sixth attempt, 15-minute boundary, success clearing and restart behavior | Fifth failure is 401, next attempt throttles, window expiry/success clears, unrelated key remains independent | `server/tests/lab-03/login-limiter.test.ts` | Planned |
| UNIT-04 | Unit | BR-18; AC-23 | Enumerate every pair in the 8×8 status matrix and unknown value | Only documented transitions pass; same/disallowed/unknown values fail | `server/tests/lab-03/ticket-status.test.ts` | Planned |
| UNIT-05 | Unit | BR-25, BR-26; AC-12, AC-18 | Requester/queue query defaults, unknown/repeated fields, ID/page/offset limits, allowed sorts and sizes | Exact parsed defaults or documented validation; stable ordering definition | `server/tests/lab-03/ticket-query.test.ts` | Planned |
| MIG-01 | Migration/regression | BR-32; AC-40 | Populate old schema, snapshot all IDs/links/timestamps and attachment file checksums, upgrade, compare; clean install; email collisions | No row/file loss; identities/relationships preserved; IT Priority copied; collisions stop before conflicting rewrite | `server/tests/lab-03/migration.test.ts` | Planned |
| MIG-02 | Migration/security | BR-02, BR-04, BR-32; AC-03, AC-05, AC-40 | Ordered legacy credential bootstrap, incomplete-upgrade refusal, inactive users, retry without hash replacement | Every legacy User receives a hash and required-change state; app cannot expose incomplete upgrade; retry preserves initialized hashes | `server/tests/lab-03/migration.test.ts` | Planned |
| SEED-01 | Migration/regression | BR-33; AC-41 | Fresh minimum fixture counts and diversity; seed twice after editing password/status/owner/activation and adding user data | Minimum role/activation/ticket fixtures exist; second seed creates no duplicates and preserves all changed values | `server/tests/lab-03/database-seed.test.ts` | Planned |
| API-01 | API/integration | FR-01; AC-01, AC-02, AC-05 | Active normalized-email login, wrong/unknown/inactive credentials, limits, cookie attributes, secret exclusion | Safe AuthResult/cookie on success; generic 401 or 429 with Retry-After; no secret fields | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-02 | API/integration | FR-02, FR-03; AC-03, AC-04, AC-06 | Initial gate, me, current/new password boundaries and reuse, logout repeat, expiry, replacement session, multiple-session revocation | Only allowed gate endpoints work; password change is atomic; old/expired/logged-out sessions fail | `server/tests/lab-03/auth.api.test.ts` | Planned |
| SEC-01 | Security/API | BR-07; AC-07 | Configured/missing/null/foreign Origin for JSON and multipart mutations; login CSRF; preflight and credentialed CORS | Valid origin succeeds; forbidden origin cannot mutate; credentials never granted to wildcard/foreign origin | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| SEC-02 | Security/authorization | FR-04; AC-03, AC-08, AC-09 | Every authorization-matrix route/method for unauthenticated, initial-password, Requester, staff, Admin, inactive/revoked sessions | Correct 401/403/allowed behavior; requesterId input rejected, removed requester route absent; no mutation by forbidden callers | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| SEC-03 | Security/authorization | BR-11, BR-21; AC-13, AC-26, AC-27 | Requester B targets A's ticket, attachment metadata/download/upload/removal, comments and indication; Requester targets notes | Same concealed 404 for A/missing resources; notes are generic 403 before lookup and absent from every Requester payload/count | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-03 | API/regression | FR-05, FR-06; AC-08, AC-10, AC-11 | Authenticated references/create with no identity input, owned generated fields, number collision retry, all field boundaries | Active ordered references; exact created fields and priority copy; invalid data cannot create; spoofed identity rejected | `server/tests/lab-03/requester-regression.api.test.ts` | Planned |
| API-04 | API/regression | FR-05, FR-06; AC-12, AC-13 | Owned list/detail, search, each filter/status/sort, tie ordering, page sizes, empty/beyond-end and detail shape | Only authenticated owner's records; Lab 2 behavior retained with new statuses; no notes | `server/tests/lab-03/requester-regression.api.test.ts` | Planned |
| API-05 | API/regression | BR-22, BR-23; AC-14, AC-15, AC-27 | Attachment lifecycle in every status, file signatures/type/size/count/reason limits, metadata, downloads, compensation, staff read-only permissions | Permitted operations work; invalid/foreign/removed/forbidden operations return exact statuses; failed writes clean up new files | `server/tests/lab-03/attachments-regression.api.test.ts` | Planned |
| API-06 | PostgreSQL integration | BR-23; AC-15 | Two simultaneous uploads when four active attachments exist | Exactly one new active file succeeds; final count five and no orphaned file | `server/tests/lab-03/attachments-concurrency.api.test.ts` | Planned |
| API-07 | API/integration | FR-07; AC-17, AC-18 | Queue search across all three fields, each filter and combinations, ownership modes, every sort/direction/page size, invalid and beyond-end queries | Matching deterministic page, consistent totals, correct mine and unassigned behavior; safe 400 on invalid query | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-08 | API/integration | FR-07, FR-08; AC-19, AC-21, AC-22 | Cross-staff Detail, exact safe fields/ownerOptions, owner assignment/unassignment eligibility, IT Priority edits | All staff can operate others' tickets; only active staff/Admin choices; requested fields immutable; missing/invalid cases safe | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-09 | PostgreSQL integration | BR-16; AC-20 | Two authenticated staff claim one unassigned ticket concurrently; already-owned and repeat claims | Exactly one 200 and one 409, one eligible owner, no status change | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-10 | API/integration | FR-09; AC-23, AC-24 | All status pairs via API, unknown/same values, Requester denial, indication first/repeat/prohibited state and Reopened clearing | Matrix enforced atomically; no partial mutations; indication is independent and repeat-safe | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-11 | API/integration | FR-10, FR-11; AC-25, AC-26 | Public Comment/Internal Note limits 0/1/max/max+1 and whitespace-only, authorship spoofing, chronological ties, all statuses, unsupported edit/delete | Trimmed append-only entries with server author/time; wrong roles/ownership denied; no writable metadata | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-12 | API/integration | FR-12; AC-28, AC-29, AC-30 | User list active/inactive/search/one-role filter, create/basic patch, required fields, normalization and invalid role arrays | Safe users only, correct filtered order, one role, hashed initial credentials, exact validation/conflicts | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-13 | PostgreSQL integration | BR-03, BR-28; AC-21, AC-29, AC-31 | Duplicate-email concurrent creates; simultaneous last-admin changes; owner assignment versus deactivation/role change; self-deactivation | At least one active Admin remains; no duplicate email or ineligible owner; conflicts preserve prior data | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-14 | API/integration | FR-13; AC-30, AC-31, AC-32 | Assigned-owner guards in every status, deactivation/reactivation, role/session changes, reset/reuse, inactive reset, self-role/self-reset | Guard conflicts; deactivation/reset revoke sessions; reactivation needs login; reset always requires next-login change | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| SEC-04 | Security/API | BR-30; AC-33 | Malformed/oversized JSON, invalid numeric/type/unknown input; injected database/hash/storage failures for each route group; forbidden resource probes | Safe JSON error/status with no token/hash/password/path/SQL/stack or protected count; no partial writes | `server/tests/lab-03/safe-errors.api.test.ts` | Planned |
| UI-01 | UI component | FR-01, FR-14; AC-02, AC-34 | Login fields/rules, normalized email, invalid/inactive/throttle/error/success, deferred request and repeated click | Labelled form; generic failure; preserved email; one request while busy; role/gate destination | `client/tests/lab-03/Login.test.tsx` | Planned |
| UI-02 | UI component | FR-02, FR-14; AC-03, AC-04, AC-34 | Mandatory/voluntary password modes, exact confirmation, wrong/reused/boundary password, busy/error/success | Gate cannot be bypassed; no confirmation field sent; inputs stay masked; valid result continues | `client/tests/lab-03/ChangePassword.test.tsx` | Planned |
| UI-03 | UI component | FR-04; AC-08, AC-09, AC-38 | Session bootstrap/reload, all role navigation, direct route refusal, stale selector storage, expiry/logout/self-account change | Name/role visible; protected content gated; obsolete state ignored/removed; prior-user data cleared | `client/tests/lab-03/AuthenticatedShell.test.tsx` | Planned |
| UI-04 | UI regression | FR-05, FR-06; AC-11, AC-16, AC-35 | Authenticated Create Ticket, validation, deferred submission, API failure and optional-upload partial failure | Correct request without requesterId; retained input/file and saved-number partial-success behavior | `client/tests/lab-03/RequesterRegression.test.tsx` | Planned |
| UI-05 | UI regression | FR-05, FR-06; AC-12, AC-14, AC-15, AC-35 | My Tickets controls/page navigation, Detail read-only fields, active/removed files, upload retention, removal reason/confirmation | Existing actions work through auth with safe loading/empty/no-results/failure and Attachment states | `client/tests/lab-03/RequesterRegression.test.tsx` | Planned |
| UI-06 | UI component/security | FR-09, FR-10; AC-24, AC-25, AC-35 | Requester indication allowed/prohibited/repeated states, public composer validation, author/time and HTML-like text | Indication never changes formal status; plain text remains inert; no private controls/data | `client/tests/lab-03/RequesterTicketDetail.test.tsx` | Planned |
| UI-07 | UI component | FR-07; AC-17, AC-18, AC-36 | Queue controls/defaults, sort/page updates, filter resets, empty/no-results/loading/error/forbidden, open and return | Exact queries and pagination retained; documented columns/cards and feedback | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-08 | UI component | FR-08, FR-09; AC-19, AC-20, AC-21, AC-22, AC-23, AC-36 | Cross-staff operation controls, claim conflict, eligible owner choices, reassignment/unassignment and terminal-transition confirmation/cancel | Correct mutations only after required confirmation, one pending request, refresh after conflict; read-only requested fields | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-09 | UI component/security | FR-10, FR-11; AC-25, AC-26, AC-27, AC-36 | Separate public/internal composers, lengths, safe HTML-like content, author/time/order, active downloads and removed metadata | Clearly distinct visibility, inert text, no edit/delete/upload/remove controls for staff; save failures retain draft | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-10 | UI component | FR-12, FR-13; AC-28, AC-29, AC-30, AC-31, AC-32, AC-37 | User list/create/edit/reset, search/role filter, duplicate/invalid/conflict feedback, confirmations, busy/success/failure, self-account changes | Minimalist labelled modes make exact API requests, preserve invalid drafts, refresh after success, no excluded features | `client/tests/lab-03/UserManagement.test.tsx` | Planned |
| STYLE-01 | UI style/accessibility | FR-14; AC-34, AC-35, AC-36, AC-37, AC-38, AC-39 | Shared header/buttons/cards/labels, required/invalid/read-only treatment, all badges, distinct public/private headings, disabled/busy/focus states | Required semantic labels/styles and role navigation render consistently; status is never color-only | `client/tests/lab-03/ZenGreen.test.tsx` | Planned |
| RESP-01 | Responsive/accessibility | FR-14; AC-39 | All major screens at 1440×1000, 820×1180, 390×844, plus 767/768 and 991/992 breakpoint edges; long text and open dialogs | No page overflow/clipping/overlap; all controls available; cards/forms adapt; evidence screenshots saved | `e2e/lab-03/responsive-accessibility.spec.ts` | Planned |
| RESP-02 | Accessibility/E2E | FR-14; AC-39 | Keyboard-only routes/forms/table links/sorting, visible focus, first error, dialog focus trap/Escape/restore, status/alert announcements | Controls work without pointer, required focus behavior holds, fields have accessible names/messages | `e2e/lab-03/responsive-accessibility.spec.ts` | Planned |
| E2E-01 | E2E/security | FR-01–FR-04; AC-01, AC-02, AC-03, AC-04, AC-06, AC-09, AC-34, AC-38 | Real login invalid/inactive/valid, initial-password gate/change, reload/current role, logout, direct API/route after logout | Only valid completed authentication reaches the role home; logout ends access; captures authentication evidence | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-02 | E2E/regression | FR-05, FR-06, FR-10; AC-08, AC-11, AC-12, AC-13, AC-14, AC-16, AC-24, AC-25, AC-35 | Requester A creates/finds/opens ticket, uploads/downloads/removes, comments/indicates; B tries direct owned resources | Complete authenticated Lab 2 flow, valid new communication, B concealed; no selector or identity query | `e2e/lab-03/requester-regression.spec.ts` | Planned |
| E2E-03 | E2E | FR-07–FR-11; AC-17, AC-18, AC-19, AC-20, AC-21, AC-22, AC-23, AC-24, AC-25, AC-26, AC-27, AC-36 | Staff searches/pages/opens, claims/reassigns, changes IT Priority/status, comments/notes, downloads, resolves/reopens indicated ticket; Requester rereads | End-to-end operations persist; confirmations work; Requester sees public content but no Internal Note; screenshots saved | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-04 | E2E/security | FR-12, FR-13; AC-28, AC-29, AC-30, AC-31, AC-32, AC-37, AC-38 | Admin lists/searches/filters, creates/edits, triggers duplicate/safety denials, deactivates/reactivates and resets; target logs in/changes password | User state and role are persisted, sessions revoked, next-login gate required; non-admin denied; evidence captured | `e2e/lab-03/user-administration.spec.ts` | Planned |

Existing Lab 1/Lab 2 tests remain regression assets. Update identity-specific
fixtures to authenticated sessions; replace obsolete selector assertions with
the explicit removal/authorization tests above. Preserve Ticket number,
validation, list, attachment compensation and lifecycle coverage. Extend
`client/playwright.config.ts` discovery to both lab directories instead of
leaving it fixed to Lab 2 or silently excluding legacy regression flows.

## 3. Acceptance-Criterion Traceability

Each AC from specification.md appears individually below. Test IDs resolve to
rows with planned actual paths above; no range shorthand hides an unmapped AC.

| Acceptance criterion | Planned tests |
|---|---|
| AC-01 | API-01, E2E-01 |
| AC-02 | UNIT-03, API-01, UI-01, E2E-01 |
| AC-03 | MIG-02, API-02, SEC-02, UI-02, E2E-01 |
| AC-04 | UNIT-01, API-02, UI-02, E2E-01 |
| AC-05 | UNIT-01, UNIT-02, MIG-02, API-01 |
| AC-06 | UNIT-02, API-02, E2E-01 |
| AC-07 | SEC-01 |
| AC-08 | SEC-02, API-03, UI-03, E2E-02 |
| AC-09 | SEC-02, UI-03, E2E-01 |
| AC-10 | API-03 |
| AC-11 | API-03, UI-04, E2E-02 |
| AC-12 | UNIT-05, API-04, UI-05, E2E-02 |
| AC-13 | SEC-03, API-04, E2E-02 |
| AC-14 | API-05, UI-05, E2E-02 |
| AC-15 | API-05, API-06, UI-05 |
| AC-16 | UI-04, E2E-02 |
| AC-17 | API-07, UI-07, E2E-03 |
| AC-18 | UNIT-05, API-07, UI-07, E2E-03 |
| AC-19 | API-08, UI-08, E2E-03 |
| AC-20 | API-09, UI-08, E2E-03 |
| AC-21 | API-08, API-13, UI-08, E2E-03 |
| AC-22 | API-08, UI-08, E2E-03 |
| AC-23 | UNIT-04, API-10, UI-08, E2E-03 |
| AC-24 | API-10, UI-06, E2E-02, E2E-03 |
| AC-25 | API-11, UI-06, UI-09, E2E-02, E2E-03 |
| AC-26 | SEC-03, API-11, UI-09, E2E-03 |
| AC-27 | SEC-03, API-05, UI-09, E2E-03 |
| AC-28 | API-12, UI-10, E2E-04 |
| AC-29 | API-12, API-13, UI-10, E2E-04 |
| AC-30 | API-12, API-14, UI-10, E2E-04 |
| AC-31 | API-13, API-14, UI-10, E2E-04 |
| AC-32 | API-14, UI-10, E2E-04 |
| AC-33 | SEC-04 |
| AC-34 | UI-01, UI-02, STYLE-01, E2E-01 |
| AC-35 | UI-04, UI-05, UI-06, STYLE-01, E2E-02 |
| AC-36 | UI-07, UI-08, UI-09, STYLE-01, E2E-03 |
| AC-37 | UI-10, STYLE-01, E2E-04 |
| AC-38 | UI-03, STYLE-01, E2E-01, E2E-04 |
| AC-39 | STYLE-01, RESP-01, RESP-02 |
| AC-40 | MIG-01, MIG-02 |
| AC-41 | SEED-01 |

## 4. Responsive and Visual Checklist

All checks are planned and must later identify screenshot paths and actual
observations. An automated no-overflow assertion complements visual inspection;
it does not prove labels, contrast, or focus are readable.

| Check | Evidence to collect | Status |
|---|---|---|
| Login / Change Password | `artifacts/lab-03/screenshots/authentication/`: each viewport, mandatory mode, invalid/inactive, busy/failure, visible identity/role, logout denial | Planned |
| Authenticated Requester regression | `artifacts/lab-03/screenshots/requester/`: Create, list and Detail at each viewport; active/removed Attachment, public content, indication | Planned |
| Staff Queue | `artifacts/lab-03/screenshots/staff-queue/`: populated rows/cards, both priorities, owner, controls/page, empty/no-results/failure | Planned |
| Staff Detail | `artifacts/lab-03/screenshots/staff-ticket-detail/`: operations/confirmation, public/private composers, Attachment read-only behavior, indication/conflict | Planned |
| User Management | `artifacts/lab-03/screenshots/user-management/`: list/create/edit/reset at each viewport; validation, safety conflict, forbidden/failure | Planned |
| Zen Green consistency | Compare header/nav, shared forms/cards/buttons/badges, read-only values, adjacent field errors and busy controls with ui-spec.md | Planned |
| Keyboard and responsive correctness | Inspect visible focus, order, dialog behavior, long text, no clipping/overlap/hidden controls/page overflow, breakpoint edges | Planned |

## 5. Verification Commands and Evidence Recording

Use the repository's existing commands; RTK is the local command wrapper.
Run migration/seed commands only with the isolated test database configuration
and documented expand/bootstrap/harden sequence. Implementation must document
the bootstrap runner command in README before claiming migration success.

```bash
rtk npm test --prefix server
rtk npm run build --prefix server
rtk npm test --prefix client
rtk npm run build --prefix client
rtk npm run test:e2e --prefix client
rtk git diff --check
```

For the documentation contract itself, run diff whitespace validation and
structural/traceability checks for six required files, numbered FR/BR/AC values,
all authorization/status rules, endpoint/UI alignment, and every AC mapped to
at least one planned test. These document checks do not mark a product test Pass.

For each implementation increment record command, date, exact commit, pass/fail
counts, affected test IDs, and any limitation. For release, rerun all relevant
suites, migration/seed verification, and builds from final main; link outputs
and screenshots rather than reporting an unverified completion assertion.

## 6. Results and Known Limits

At contract authoring, Lab 3 implementation tests have not been run. All planned
test rows and visual checks remain Planned. The existing Lab 2 results document
the previous increment and do not establish Lab 3 correctness.

The login limiter is one-process memory only; restart/distribution behavior is
documented and unit-tested as a limitation. Local attachment storage and a
single configured browser origin are the supported lab setup. Email delivery,
MFA/SSO, Actions Taken, production deployment, and other excluded scope do not
require implementation tests in this sprint. Peer approvals and final-main
results are recorded only when the underlying work has occurred.
