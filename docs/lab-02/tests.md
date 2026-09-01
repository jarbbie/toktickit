# Lab 2 Test Plan and Results

## 1. Test Strategy

Write planned tests before each implementation increment. API tests use Vitest
and Supertest; client tests use Vitest and Testing Library; E2E and viewport
evidence use Playwright. Tests use seeded active Requesters A and B plus an
inactive requester.

## 2. Planned Tests

| ID | Type | AC | What it proves | Expected result | Automated test file | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | AC-03 | Ticket-number generator produces `TKT-YYYY-XXXXXXXX` | Required format is returned | `server/tests/lab-02/ticket-number.test.ts` | Pass |
| API-01 | API | AC-01 | Active requester, Category, and Related System APIs exclude inactive data | Ordered active records only | `server/tests/lab-02/reference-data.api.test.ts` | Pass |
| API-02 | API | AC-03, AC-04 | Ticket creation, validation, references, duplicate retry, and malformed JSON | Safe `201` or documented safe error; invalid ticket is not stored | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-03 | API | AC-06, AC-08, AC-09 | Owned list search/filter/sort/page response | Matching owned page and metadata | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-04 | API | AC-07, AC-10 | Owned detail succeeds; cross-requester detail returns 404 | Owned `200`; unowned `404` | `server/tests/lab-02/ticket-detail-attachments.api.test.ts` | Pass |
| API-05 | API | AC-11, AC-12, AC-13 | Attachment upload limits, removal, and blocked download | Documented status; removed attachment cannot download | `server/tests/lab-02/ticket-detail-attachments.api.test.ts` | Pass |
| UI-01 | UI | AC-01, AC-02 | Selector loading, empty, failure, selection, and Change Requester states | Correct state and route/context behavior | `client/tests/lab-02/RequesterSelection.test.tsx` | Pass |
| UI-02 | UI | AC-03–AC-05 | Create form validation, busy, success, and retained failure values | Field messages; disabled busy button; success or retained values | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-03 | UI | AC-06, AC-08, AC-09 | My Tickets loading, filters, pagination, empty/no-results/error states | Correct list state and query behavior | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| UI-04 | UI | AC-10–AC-13 | Read-only detail and attachment action states | Visible detail; removed metadata; safe attachment failure | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Pass |
| STYLE-01 | UI style | AC-14 | Zen Green header/nav, labels, asterisks, invalid classes, busy controls, read-only fields, and badges | Required classes/states render; visual review has no responsive defects | `client/tests/lab-02/CreateTicket.test.tsx`, `client/tests/lab-02/MyTickets.test.tsx`, and `client/e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| E2E-01 | E2E | AC-03, AC-06, AC-10–AC-13 | Requester creates a ticket, finds/opens it, uploads, downloads, and removes an attachment | Created ticket is found; `evidence.pdf` downloads; removed link is absent | `client/e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| E2E-02 | E2E | AC-07 | Requester switch hides A's data and blocks direct detail access | A's ticket is hidden and its detail returns a safe error for B | `client/e2e/lab-02/requester-ownership-responsive.spec.ts` | Pass |

## 3. Acceptance-Criterion Traceability

| Acceptance criterion | Planned tests |
|---|---|
| AC-01 | API-01, UI-01 |
| AC-02 | UI-01 |
| AC-03 | UNIT-01, API-02, UI-02, E2E-01 |
| AC-04 | API-02, UI-02 |
| AC-05 | UI-02 |
| AC-06 | API-03, UI-03, E2E-01 |
| AC-07 | API-04, API-05, E2E-02 |
| AC-08 | API-03, UI-03 |
| AC-09 | API-03, UI-03 |
| AC-10 | API-04, UI-04, E2E-01 |
| AC-11 | API-05, UI-04 |
| AC-12 | API-05, UI-04 |
| AC-13 | API-05, UI-04 |
| AC-14 | STYLE-01, E2E-01 |

## 4. Responsive and Visual Checklist

| Check | Evidence and result |
|---|---|
| Desktop, tablet, mobile layout | Create Ticket, My Tickets, and removed Ticket Detail are captured at 1440×1000, 820×1180, and 390×844 under `artifacts/lab-02/screenshots/`. Pass. |
| Clipping and horizontal overflow | The E2E capture helper asserts `scrollWidth <= clientWidth` at every captured viewport; desktop My Tickets plus mobile Create Ticket and My Tickets were manually inspected. Pass. |
| Zen Green states | Header/nav, labels, required markers, invalid and busy controls, pale read-only fields, and priority/status badges are covered by `CreateTicket.test.tsx` and `MyTickets.test.tsx`. Pass. |
| Attachment controls and readable names | `ticket-detail-active/1440x1000.png` visibly shows `evidence.pdf` with Download/Remove; removed-detail screenshots retain metadata without Download. Pass. |
| UI-spec comparison | The inspected layouts use the approved responsive form/table/card behavior, Zen Green primary actions, and separate Ticket/Attachment sections from `ui-spec.md`. Pass. |

## 5. Test Commands

```bash
npm test --prefix server
npm run build --prefix server
npm test --prefix client
npm run build --prefix client
npm run test:e2e --prefix client
```

## 6. Final Results

The following history records verification at each implementation increment.
The release-verification results below are the final result for Lab 2.

Requester-context verification completed on `feature/7-requester-context`:

- `npx prisma migrate status` — 2 migrations found; database schema up to date.
- `npx prisma db seed` — passed; seed remains idempotent.
- `cd server && npm test` — 6 tests passed.
- `cd server && npm run build` — passed.
- `cd client && npm test` — 5 tests passed.
- `cd client && npm run build` — passed.

Ticket-creation API verification completed on `feature/8-ticket-create-api`:

- `npx prisma migrate status` — 2 migrations found; database schema up to date.
- `npx prisma db seed` — passed; seed remains idempotent.
- `cd server && npm test` — 17 tests passed.
- `cd server && npm run build` — passed.
- `cd client && npm test` — 5 tests passed.
- `cd client && npm run build` — passed.

Create Ticket UI verification completed on `feature/9-create-ticket-ui`:

- `cd server && npm test` — 17 tests passed.
- `cd server && npm run build` — passed.
- `cd client && npm test` — 9 tests passed.
- `cd client && npm run build` — passed.

My Tickets verification completed on `feature/10-my-tickets`:

- Focused API tests cover requester ownership, filters, pagination, invalid queries, and safe failures.
- Focused UI tests cover ticket display, filters, empty/no-match states, and retry.

Ticket Detail and Attachments verification completed on `feature/11-ticket-detail-attachments`:

- API tests cover owned/unowned access, type and size validation, five-file limit, upload, soft removal, and blocked download.
- UI tests cover read-only detail, removal metadata/actions, and retained file selection after upload failure.

Release verification completed on `feature/12-lab2-verification`:

- `cd server && npx prisma migrate status` — 2 migrations found; database schema up to date.
- `cd server && npm run prisma:seed` — passed; seed remains idempotent.
- `cd server && npm test` — 32 tests passed.
- `cd server && npm run build` — passed.
- `cd client && npm test` — 15 tests passed.
- `cd client && npm run build` — passed.
- `cd client && npm run test:e2e` — 2 tests passed; it seeds the database,
  verifies an active attachment download filename, and creates the ten
  screenshots listed above.

Zen Green UI alignment verification completed on `feature/29-zen-green-ui`:

- `npm test --prefix server` — 32 tests passed.
- `npm run build --prefix server` — passed.
- `npm test --prefix client` — 15 tests passed, including the header,
  navigation, read-only-field, and badge assertions.
- `npm run build --prefix client` — passed.
- `npm run test:e2e --prefix client` — 2 tests passed and refreshed the
  desktop, tablet, and mobile Zen Green screenshots.

## 7. Known Limitations or Deferred Tests

Authentication, roles, IT Staff workflow, comments, notes, actions, and ticket
lifecycle changes are deferred because they are outside Lab 2 scope.
