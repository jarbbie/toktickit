# Lab 2 Test Plan and Results

## 1. Test Strategy

Write planned tests before each implementation increment. API tests use Vitest
and Supertest; client tests use Vitest and Testing Library; E2E and viewport
evidence use Playwright. Tests use seeded active Requesters A and B plus an
inactive requester.

## 2. Planned Tests

| ID | Type | AC | What it proves | Planned file | Final |
|---|---|---|---|---|---|
| UNIT-01 | Unit | AC-03 | Ticket-number generator produces `TKT-YYYY-XXXXXXXX` | `server/tests/lab-02/ticket-number.test.ts` | Pass |
| API-01 | API | AC-01 | Active requester, Category, and Related System APIs exclude inactive data | `server/tests/lab-02/reference-data.api.test.ts` | Pass |
| API-02 | API | AC-03, AC-04 | Valid ticket creates `NEW`; validation, inactive references, duplicate retry, and malformed JSON return safe responses | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-03 | API | AC-06, AC-08, AC-09 | Owned list search/filter/sort/page response is correct | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-04 | API | AC-07, AC-10 | Owned detail succeeds; cross-requester detail returns 404 | `server/tests/lab-02/ticket-detail-attachments.api.test.ts` | Pass |
| API-05 | API | AC-11, AC-12, AC-13 | Upload, size/type/count limits, removal, and blocked download | `server/tests/lab-02/ticket-detail-attachments.api.test.ts` | Pass |
| UI-01 | UI | AC-01, AC-02 | Selector loading, empty, failure, selection, and Change Requester states | `client/tests/lab-02/RequesterSelection.test.tsx` | Pass |
| UI-02 | UI | AC-03–AC-05 | Create form validation, busy, success, and retained failure values | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-03 | UI | AC-06, AC-08, AC-09 | My Tickets loading, filters, pagination, empty/no-results/error states | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| UI-04 | UI | AC-10–AC-13 | Read-only detail and attachment action states | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Pass |
| STYLE-01 | Manual UI style | AC-14 | Labels, asterisks, invalid classes, busy controls, and read-only treatment | `client/tests/lab-02/CreateTicket.test.tsx`, `client/tests/lab-02/RequesterTicketDetail.test.tsx`, and visual checklist | Pass (manual review) |
| E2E-01 | E2E | AC-03, AC-06, AC-10 | Requester creates a ticket, finds/opens it, uploads, and removes an attachment | `client/e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| E2E-02 | E2E | AC-07, AC-14 | Requester switch hides A's data; desktop/tablet/mobile screens remain usable | `client/e2e/lab-02/requester-ownership-responsive.spec.ts` | Pass |

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
| AC-14 | STYLE-01, E2E-02 |

## 4. Responsive and Visual Checklist

- Inspect Create Ticket, My Tickets, and Ticket Detail at desktop (≥992px),
  tablet (768–991px), and mobile (<768px).
- Confirm no clipping, overlap, horizontal overflow, missing focus state, or
  unreadable file name.
- Confirm editable, read-only, invalid, disabled, busy, success, warning, and
  error states conform to `ui-spec.md`.
- Evidence is stored in `artifacts/lab-02/screenshots/`: Create Ticket, My
  Tickets, and Ticket Detail at 1440×1000, 820×1180, and 390×844. A desktop
  Ticket Detail capture and a mobile Create Ticket capture were manually
  inspected: content is readable, controls remain reachable, and no horizontal
  clipping was observed.

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
- `cd client && npm test` — 14 tests passed.
- `cd client && npm run build` — passed.
- `cd client && npm run test:e2e` — 2 tests passed; it seeds the database and
  creates the nine screenshots listed above.

## 7. Known Limitations or Deferred Tests

Authentication, roles, IT Staff workflow, comments, notes, actions, and ticket
lifecycle changes are deferred because they are outside Lab 2 scope.
