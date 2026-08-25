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
| API-03 | API | AC-06, AC-08, AC-09 | Owned list search/filter/sort/page response is correct | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-04 | API | AC-07, AC-10 | Owned detail succeeds; cross-requester detail returns 404 | `server/tests/lab-02/ticket-detail.api.test.ts` | Planned |
| API-05 | API | AC-11, AC-12, AC-13 | Upload, size/type/count limits, removal, and blocked download | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| UI-01 | UI | AC-01, AC-02 | Selector loading, empty, failure, selection, and Change Requester states | `client/tests/lab-02/RequesterSelection.test.tsx` | Pass |
| UI-02 | UI | AC-03–AC-05 | Create form validation, busy, success, and retained failure values | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-03 | UI | AC-06, AC-08, AC-09 | My Tickets loading, filters, pagination, empty/no-results/error states | `client/tests/lab-02/MyTickets.test.tsx` | Planned |
| UI-04 | UI | AC-10–AC-13 | Read-only detail and attachment action states | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Planned |
| STYLE-01 | UI style | AC-14 | Labels, asterisks, invalid classes, busy controls, and read-only treatment | `client/tests/lab-02/ui-style.test.tsx` | Planned |
| E2E-01 | E2E | AC-03, AC-06, AC-10 | Requester creates a ticket and finds/opens it | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-02 | E2E | AC-07, AC-14 | Requester switch hides A's data; desktop/tablet/mobile screens remain usable | `e2e/lab-02/requester-ownership-responsive.spec.ts` | Planned |

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

## 5. Test Commands

```bash
cd server && npm test
cd client && npm test
# Add the documented Playwright command when Playwright is introduced.
```

## 6. Final Results

API-01 and UI-01 pass on the requester-context feature branch. The remaining
tests are planned and require their later implementation branches.

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

## 7. Known Limitations or Deferred Tests

Authentication, roles, IT Staff workflow, comments, notes, actions, and ticket
lifecycle changes are deferred because they are outside Lab 2 scope.
