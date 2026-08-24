# Lab 2 Sprint Engineering Specification

## 1. Sprint Goal

Deliver a responsive Requester-facing TokTickIT MVP. A selected Development
Requester can create a support ticket, find only their own tickets, inspect an
owned ticket, and manage permitted attachments.

## 2. Stakeholder Request Interpretation

Lab 2 simulates multiple Requesters before real authentication is introduced.
The selected Development Requester is a testing context, not a secure identity.
The backend must still enforce ownership using that selected requester ID.

## 3. Scope

### Included

- Development Requester selection and switching.
- Create Ticket, My Tickets, Requester Ticket Detail, and attachments.
- Category and Related System reference data.
- Search, filtering, sorting, pagination, loading, empty, validation, success,
  and safe failure states.
- Zen Green responsive UI and automated test evidence.

### Excluded

- Login, passwords, sessions, tokens, and real role-based access control.
- IT Staff/Administrator functions, comments, notes, actions taken, ownership
  assignment, and ticket lifecycle changes after creation.

## 4. Functional Requirements

- **FR-01:** The application shall load active Development Requesters and let a
  user choose one before ticket screens are available.
- **FR-02:** The application shall show the selected requester and provide a
  Change Requester action.
- **FR-03:** A selected active requester shall create a ticket with Category,
  Related System, Requested Priority, Summary, Description, and optional files.
- **FR-04:** The backend shall generate a unique, read-only Ticket Number and
  set the initial status to `NEW`.
- **FR-05:** My Tickets shall return only tickets owned by the selected
  requester, with search, filters, sorting, and pagination.
- **FR-06:** A requester shall retrieve only an owned Ticket Detail.
- **FR-07:** A requester shall add, download, and soft-remove permitted
  attachments on an owned ticket.
- **FR-08:** Screens and APIs shall give clear loading, empty, validation, and
  safe error feedback.

## 5. Business Rules

- **BR-01:** Development Requester selection is only a Lab 2 test mechanism;
  every requester-specific API call supplies `requesterId` and validates that it
  belongs to an active requester.
- **BR-02:** A new ticket is owned by the selected requester and starts with
  status `NEW`.
- **BR-03:** The backend generates Ticket Number before creating the ticket,
  using `TKT-YYYY-XXXXXXXX` where the suffix is an uppercase random hexadecimal
  value. The number is unique and cannot be set by a client. If a generated
  number already exists, the server generates a new number and retries.
- **BR-04:** Category and Related System must refer to active seeded records.
- **BR-05:** Summary and Description are trimmed, required, and limited to
  200 and 4,000 characters respectively. Summary must contain 5–200 characters;
  Description must contain 10–4,000 characters.
- **BR-06:** Requested Priority is exactly `LOW`, `MEDIUM`, `HIGH`, or
  `URGENT`; its default is `MEDIUM`.
- **BR-07:** A requester can list, retrieve, upload to, download from, or
  remove only tickets they own. Ownership failures return `404` to avoid
  revealing another requester’s data.
- **BR-08:** Ticket search matches Ticket Number and Summary, case-insensitively.
  The list supports Category, Requested Priority, and Status filters.
- **BR-09:** Ticket lists default to newest updated first. Allowed sort fields
  are `updatedAt`, `createdAt`, `ticketNumber`, and `requestedPriority`; page is
  one-based and allowed page sizes are 5, 10, and 20.
- **BR-10:** Allowed attachment types are JPG/JPEG, PNG, WEBP, and PDF. Each
  file is at most 5 MB, and a Ticket has at most five active attachments.
- **BR-11:** An attachment is stored under a generated server-side key; the
  original filename is metadata only. Removed attachments retain metadata,
  `removedAt`, and a required 1–500 character removal reason, but cannot be
  downloaded or previewed.
- **BR-12:** Submit/upload controls are disabled while their request is pending.
  Form values remain visible after a failed create or upload request.
- **BR-13:** An inactive requester is never offered for selection and cannot be
  used as `requesterId`.

## 6. UI Specification Summary

The UI follows `ui-spec.md`: Zen Green navigation, labels above controls,
field-level validation, visible focus, and accessible text controls. Desktop
uses a centered multi-column form/table; tablet reduces columns; mobile stacks
controls and uses ticket cards or a responsive table. Create Ticket, My Tickets,
and Ticket Detail handle loading, empty, no-results, success, and failure states.

## 7. Data Changes

Add these Prisma enums and models. This is the approved target schema; the
implementation branch will turn it into a migration.

```prisma
enum RequestedPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum TicketStatus {
  NEW
}

model Requester {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  tickets   Ticket[]

  @@index([isActive, name])
}

model Category {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  tickets   Ticket[]
}

model RelatedSystem {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  tickets   Ticket[]
}

model Ticket {
  id                Int               @id @default(autoincrement())
  ticketNumber      String            @unique @db.VarChar(32)
  requesterId       Int
  categoryId        Int
  relatedSystemId   Int
  requestedPriority RequestedPriority @default(MEDIUM)
  status            TicketStatus      @default(NEW)
  summary           String            @db.VarChar(200)
  description       String            @db.VarChar(4000)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  requester         Requester         @relation(fields: [requesterId], references: [id])
  category          Category          @relation(fields: [categoryId], references: [id])
  relatedSystem     RelatedSystem     @relation(fields: [relatedSystemId], references: [id])
  attachments       Attachment[]

  @@index([requesterId, updatedAt])
}

model Attachment {
  id             Int       @id @default(autoincrement())
  ticketId       Int
  originalName   String    @db.VarChar(255)
  storageKey     String    @unique @db.VarChar(64)
  mimeType       String    @db.VarChar(100)
  sizeBytes      Int
  createdAt      DateTime  @default(now())
  removedAt      DateTime?
  removalReason  String?   @db.VarChar(500)
  ticket         Ticket    @relation(fields: [ticketId], references: [id])

  @@index([ticketId, removedAt])
}
```

`Ticket.requesterId`, `categoryId`, and `relatedSystemId` are required foreign
keys. A requester has many tickets; Category and RelatedSystem each have many
tickets; a Ticket has zero to many Attachments; each Attachment has one Ticket.
Files live under a gitignored server upload directory, not in PostgreSQL.

## 8. API Contract Summary

The detailed contract is in `api-spec.md`. APIs provide active requesters and
reference data, ticket creation and requester-owned list/detail access, plus
attachment upload, metadata, download, and soft removal. The backend validates
all client input and ownership; the client selector never substitutes for these
checks.

## 9. Acceptance Criteria

- **AC-01:** Given active requesters exist, when the selector loads, then it
  shows active requesters and not inactive requesters.
- **AC-02:** Given no selected requester, when a requester-only route is opened,
  then the selector is shown instead of ticket data.
- **AC-03:** Given valid ticket data and a selected requester, when submitted,
  then one ticket is saved with that requester ID, status `NEW`, and a generated
  Ticket Number shown to the requester.
- **AC-04:** Given missing or invalid ticket fields, when submitted, then the
  associated field messages are shown and no ticket is created.
- **AC-05:** Given a create API failure, when submission fails, then a useful
  error is shown and entered values remain available.
- **AC-06:** Given Requester A owns tickets, when A opens My Tickets, then only
  A's tickets are returned with pagination metadata.
- **AC-07:** Given Requester B is selected, when B requests A's ticket or its
  attachment, then the API returns `404` and no protected data is returned.
- **AC-08:** Given owned tickets, when search, filters, sorting, or page changes,
  then the list returns the documented matching ordered page.
- **AC-09:** Given an owned ticket with no matches or no tickets, when My Tickets
  loads, then distinct no-results and empty states are displayed.
- **AC-10:** Given an owned ticket, when Detail loads, then ticket fields are
  read-only and its attachment metadata is visible.
- **AC-11:** Given a permitted attachment under the size/count limits, when
  uploaded to an owned ticket, then it becomes active and downloadable.
- **AC-12:** Given an unsupported, oversized, sixth active, or unauthorized
  attachment operation, when attempted, then it is rejected with a useful error.
- **AC-13:** Given an active owned attachment, when removal is confirmed with a
  reason, then metadata remains marked removed and download/preview is blocked.
- **AC-14:** Given desktop, tablet, or mobile viewports, when each required
  screen is used, then labels, controls, messages, and attachments remain usable
  without clipping, overlap, or horizontal page scrolling.

## 10. Definition of Done

- All included requirements and acceptance criteria are implemented.
- Prisma migration and idempotent seed data are committed; no secrets or upload
  files are committed.
- API, UI, unit, responsive/style, and E2E tests trace to this contract and pass
  from the final `main` branch.
- Ownership, validation, failure, empty, loading, and attachment-removal paths
  are tested.
- UI conforms to `ui-spec.md` at desktop, tablet, and mobile sizes.
- Documentation, screenshots, reviewer record, AI-use record, GitHub Issues,
  feature PRs, and the staging-to-main release PR are complete.

## 11. Assumptions and Decisions

- `requesterId` is sent explicitly in Lab 2 because there is no authentication;
  Lab 3 will replace this with the authenticated user identity.
- Ticket Number uses a backend random suffix and a database unique constraint;
  this avoids a separate sequence table or a two-step ticket write.
- Attachments use local development storage. A later deployment can replace the
  storage implementation without changing the Attachment metadata contract.
