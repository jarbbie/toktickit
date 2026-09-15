# Lab 3 Sprint Engineering Specification

Contract for Issue #36, written before Lab 3 feature implementation. Source:
`Lab3_Labsheet.pdf`, pages 1–18, and the [Lab 2 contract](../lab-02/specification.md).
This document defines product behavior; [api-spec.md](api-spec.md),
[ui-spec.md](ui-spec.md), and [tests.md](tests.md) specify its interfaces and evidence.

## 1. Sprint Goal

Deliver authenticated TokTickIT workspaces for Requesters, IT Staff, and
Administrators. Preserve existing requests and attachments while adding a shared
staff queue, controlled ticket operations, public communication, private notes,
and simple account administration in the existing Zen Green interface.

## 2. Stakeholder Request Interpretation

People must sign in as themselves. Requesters retain their existing ticket
functions; staff take responsibility for tickets and formally manage their
status. Public Comments support conversation with the Requester, while Internal
Notes stay within the support team. Administrators maintain accounts and initial
passwords. The server enforces every permission independently of navigation.

## 3. Scope

### Included

- Email/password login, logout, current user, mandatory initial-password change,
  and voluntary password change.
- Exactly one role per User; role navigation and server authorization.
- Preservation and migration of Lab 2 Requester, Ticket, Attachment, Category,
  and Related System data; authenticated Requester regression.
- Shared staff Queue/Detail, claim/reassignment, IT Priority, status workflow,
  Public Comments, Internal Notes, and Requester resolution indication.
- Administrator list/search/role filter, create/edit/activation, and initial
  password reset. Administrators also have IT Staff ticket capabilities.
- Planned tests, staged integration, peer review, responsive screenshots, and
  final-main evidence.

### Explicit Exclusions

Email delivery/invitations/reset links, MFA, social login, SSO, self-registration,
Actions Taken, SLA calculation, escalation, notifications, dashboards/KPIs,
multiple roles, multi-tenancy, departments/organizations/customer administration,
extended profiles/photos, user or ticket deletion, comment/note editing/deletion,
bulk administration, import/export, audit/history screens, account unlocking,
approval workflows, advanced recovery, user-list pagination/multi-column sorting,
and production deployment/cloud infrastructure are outside Lab 3. Existing
Attachment soft removal remains included. There is no Actions Taken completion
check before resolution; that later workflow belongs to Lab 4.

## 4. Functional Requirements

| ID | Requirement |
|---|---|
| FR-01 | Authenticate active users by email/password; return safe identity and establish a session. |
| FR-02 | Require users with an initial password to change it before normal application access; allow authenticated voluntary password change. |
| FR-03 | Retrieve the current user, expire and revoke sessions, and provide logout. |
| FR-04 | Show permitted navigation and enforce role/ownership permissions on every protected API and screen. |
| FR-05 | Use authenticated Requester identity for Create Ticket, My Tickets, Detail, and permitted Attachment operations; remove the development selector. |
| FR-06 | Preserve Ticket validation, number generation, reference data, list behavior, Attachment lifecycle, and partial-upload failure behavior from Lab 2. |
| FR-07 | Provide IT Staff and Administrators a shared searchable, filterable, sortable, paginated Ticket Queue and complete operational Ticket Detail. |
| FR-08 | Let staff claim unassigned tickets, assign/reassign/unassign eligible Ticket Owners, and set IT Priority. |
| FR-09 | Let staff perform the specified status transitions; show a Requester's Problem Appears Resolved indication independently of formal status. |
| FR-10 | Let an owning Requester and any staff member retrieve and append Public Comments. |
| FR-11 | Let staff retrieve and append Internal Notes; exclude notes from every Requester response and screen. |
| FR-12 | Let Administrators list/search/filter users and create or update name, email, exactly one role, and activation state. |
| FR-13 | Let Administrators set a new initial password and enforce account/assignment safety rules. |
| FR-14 | Provide accessible Zen Green screens and meaningful processing, success, validation, empty, forbidden, not-found, conflict, and safe-failure feedback. |
| FR-15 | Migrate existing data without loss and provide documented, repeatable local seed fixtures. |

## 5. Business Rules

| ID | Rule |
|---|---|
| BR-01 | Only active users with valid credentials authenticate. Unknown email, wrong password, and inactive account return the same safe login failure; logs and responses contain no credentials. |
| BR-02 | A user with `mustChangePassword=true` is limited to current-user, logout, and change-password among protected operations after login. Other protected APIs return `403 PASSWORD_CHANGE_REQUIRED`; public health/login remain available. |
| BR-03 | Normalize email by trimming and lowercasing; enforce normalized uniqueness in the database. Names are trimmed, 1–100 characters; email is syntactically valid and at most 254 characters. |
| BR-04 | Password length is 12–128 characters; passwords are not trimmed. Hash with Argon2id (memory 19456 KiB, iterations 2, parallelism 1) and a unique random salt of at least 16 bytes. A new password must differ from the current/initial password, including an Administrator reset. Never store or return plaintext passwords. |
| BR-05 | Sessions use cryptographically random opaque tokens, at least 32 random bytes. Store only a SHA-256 token hash with the User and a fixed eight-hour expiry; no sliding extension. Use an HttpOnly, SameSite=Lax cookie, Secure outside local development. |
| BR-06 | Authenticate every request against an unexpired session and current active User/role/password-change state. Logout deletes its session. Password change/reset revokes the user's sessions; successful self-change creates a fresh session. Deactivation revokes sessions; role change also revokes sessions to clear stale access. |
| BR-07 | Validate the configured client origin for unsafe cookie-authenticated requests and allow credentialed CORS only from that configured origin. Apply the same origin requirement to login; missing, null, or different Origin is rejected. |
| BR-08 | Use an in-memory lab-only login limiter: five failures for normalized email plus IP within 15 minutes; clear on success. The fifth failure returns the generic `401`; further attempts before the window expires return `429` with `Retry-After`. Restart clears counters and separate server processes do not share them. |
| BR-09 | Each User has exactly one role: `REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`. Administrators receive IT Staff ticket capabilities plus User Management permissions. |
| BR-10 | Derive Requester ownership only from authenticated identity. Remove `requesterId` inputs, selector state, and `/api/requesters`; reject obsolete identity inputs as `400`. The database's `Ticket.requesterId` remains the submission relationship. |
| BR-11 | A Requester can access only their submitted tickets and attachments. Missing and foreign-owned resources return identical safe `404` responses. Role-restricted operations return `403` before resource lookup. |
| BR-12 | New tickets start `NEW`, with no Ticket Owner and no resolution indication. The server generates unique `TKT-YYYY-XXXXXXXX` numbers and retries collisions as in Lab 2. IDs, ownership, status, timestamps, and IT Priority cannot be supplied at creation. |
| BR-13 | Ticket Summary is trimmed to 5–200 characters and Description to 10–4000; active Category and Related System are required. Requested Priority is `LOW`, `MEDIUM`, `HIGH`, or `URGENT`, default `MEDIUM`; it remains the Requester's submitted value. |
| BR-14 | IT Priority initially copies Requested Priority. Only staff can subsequently change IT Priority; doing so never changes Requested Priority. |
| BR-15 | Any authenticated IT Staff or Administrator may view and operate the staff Queue/Detail. Ticket ownership represents responsibility, not staff-to-staff authorization. Ticket Owner is distinct from the submitting Requester. |
| BR-16 | Ticket owners must be active IT Staff or Administrators. A ticket has zero or one owner. Claim is atomic: only one concurrent claimant succeeds; claiming an already assigned ticket returns `409`, including a repeated claim by its owner. Claim/assignment does not change status. |
| BR-17 | Assignment may set an eligible owner or clear ownership with `null`. Reassignment, including replacing/removing an existing owner, requires UI confirmation. Validate eligibility atomically with assignment and administrator updates. |
| BR-18 | Staff status changes follow the status matrix below, evaluated against the persisted current status within a transaction. Unknown values return `400`; illegal or same-status transitions return `409` without changes. Transitions to Resolved, Closed, or Cancelled require UI confirmation. |
| BR-19 | Problem Appears Resolved records a backend timestamp and never formally sets Resolved or Closed. Only the submitting Requester can set it on `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED`. Repeated indication preserves the first timestamp; other statuses return `409`. Clear the indication when a Ticket becomes `REOPENED`. |
| BR-20 | Public Comments are append-only, trimmed, and 1–2000 characters. Internal Notes are append-only, trimmed, and 1–4000 characters. These limits allow a useful conversation or diagnostic note without unbounded entries. The server determines author and creation time. Entries are allowed in every status, including Cancelled; terminal refers to status transitions. |
| BR-21 | Public Comments are visible to the owning Requester and all staff. Internal Notes are visible only to staff, never in Requester payloads, counts, or errors. React text rendering must remain safe: render text nodes, preserve newlines, and never interpret submitted HTML. |
| BR-22 | Preserve Lab 2 attachment permissions for Requesters in every status. Staff/Admin may view metadata and download active attachments, but not upload or remove them in Lab 3. Removed metadata remains visible to authorized readers; removed files cannot be downloaded or previewed. |
| BR-23 | Attachments allow JPEG, PNG, WEBP, and PDF with matching file signatures, at most 5 MiB each and five active files per ticket. Serialize the count check and insertion. Use generated storage keys; original filenames are metadata. Soft removal requires a trimmed 1–500 character reason and UI confirmation. Compensate stored files on a failed insertion. |
| BR-24 | Optional Create Ticket upload runs after Ticket creation. If upload fails, keep the saved Ticket and show its official number, a safe warning, and a Detail retry action. Failed creation preserves entered values/file; busy mutations prevent duplicate UI submission. |
| BR-25 | Requester list retains Lab 2 search/filter/sort/defaults and page sizes 5/10/20, with all eight statuses now filterable. Staff Queue uses the documented search, filters, sorts, defaults, and page sizes 10/20/50. Every list page uses ticket ID as the secondary ordering in the same direction. |
| BR-26 | Queue search matches Ticket Number, Summary, and Requester name, case-insensitively. Filters combine with AND; ownership is all/mine/assigned/unassigned. Default ordering is updatedAt descending. Invalid query values return `400`, an out-of-range positive page returns an empty page, and no matches yields totalPages 0. |
| BR-27 | User Management lists all active and inactive accounts, searches name/email case-insensitively, and optionally filters one role. Create requires an initial password and one permitted role. Edit is limited to name, email, role, and activation; unknown fields and duplicate normalized emails are rejected. |
| BR-28 | User Management must reject self-deactivation, loss of the last active Administrator, and deactivation/role changes for an assigned Ticket Owner until reassignment. Apply checks and updates atomically so concurrent edits cannot violate them. Assignments in any status count. |
| BR-29 | Password reset revokes target sessions and requires password change at next login. Deactivation revokes sessions. Activation does not restore old sessions. Deactivation replaces deletion and preserves submissions and authored entries. |
| BR-30 | General errors use `{ error, code?, fieldErrors? }`; use 401 unauthenticated, 403 wrong role, 404 missing or concealed Requester-owned resources, 409 conflicts, 429 login throttling, and safe 500 errors. Validation uses 400, body/file size uses 413, and attachment type uses 415. Never expose hashes, tokens, storage paths, SQL, or stack traces. |
| BR-31 | All timestamps come from the backend and serialize as ISO 8601 UTC. Ticket operational changes, new comments/notes, a first resolution indication, and Attachment changes update Ticket.updatedAt transactionally; reads and repeated indication do not. |
| BR-32 | Preserve all Lab 2 Ticket, Attachment, Category, Related System, and Requester data through migration. Preserve IDs, relationships, file storage keys/content, inactive states, and original ticket timestamps; normalize email only after collision checks. Never reset or recreate the populated database. |
| BR-33 | Seed behavior is idempotent and local-only: stable unique fixture keys, no duplicate entries, and no overwriting changed passwords, activation, ownership, status, or user-created data when rerun. Newly seeded accounts require initial-password change. |
| BR-34 | Continue Zen Green and Lab 2 responsive/accessibility rules. Clear user-specific cached data on logout, expiry, account changes, or a new login; guard direct routes before rendering protected data. |

### Authorization Matrix

“Own” means `Ticket.requesterId` matches the authenticated User. “Staff” below
includes both staff roles. All allowed authenticated operations require an active
session and completed password change unless explicitly listed otherwise.

| Operation | Unauthenticated | Initial-password session | Requester | IT Staff | Administrator |
|---|---|---|---|---|---|
| Health; login | Allowed | Allowed | Allowed | Allowed | Allowed |
| Current user | 401 | Allowed | Allowed | Allowed | Allowed |
| Logout | 204, clear cookie | Allowed | Allowed | Allowed | Allowed |
| Change own password | 401 | Allowed | Allowed | Allowed | Allowed |
| Categories / Related Systems | 401 | 403 | Read active | Read active | Read active |
| Create Ticket; My Tickets; Requester Detail | 401 | 403 | Create/list/read own | 403 | 403 |
| Attachment metadata/download | 401 | 403 | Own; active download | All; active download | All; active download |
| Attachment upload/soft removal | 401 | 403 | Own | 403 | 403 |
| Public Comments read/append | 401 | 403 | Own | All tickets | All tickets |
| Problem Appears Resolved | 401 | 403 | Own; allowed statuses | 403 | 403 |
| Staff Queue/Detail and owner choices | 401 | 403 | 403 | All tickets | All tickets |
| Claim/assignment, IT Priority, status | 401 | 403 | 403 | All tickets | All tickets |
| Internal Notes read/append | 401 | 403 | 403; no lookup/content | All tickets | All tickets |
| User list/create/edit/initial-password reset | 401 | 403 | 403 | 403 | Allowed with safety rules |

Unsupported routes, including the removed `/api/requesters`, return safe `404`.
No role has a comment/note update/delete operation or a User delete operation.

### Status and Confirmation Matrix

Only IT Staff and Administrators perform these transitions. API enum values map
to title-case UI labels (`WAITING_FOR_REQUESTER` → “Waiting for Requester”).

| Current status | Permitted next statuses | Next statuses requiring UI confirmation |
|---|---|---|
| NEW | OPEN, IN_PROGRESS, CANCELLED | CANCELLED |
| OPEN | IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CANCELLED | RESOLVED, CANCELLED |
| IN_PROGRESS | WAITING_FOR_REQUESTER, RESOLVED, CANCELLED | RESOLVED, CANCELLED |
| WAITING_FOR_REQUESTER | IN_PROGRESS, RESOLVED, CANCELLED | RESOLVED, CANCELLED |
| RESOLVED | CLOSED, REOPENED | CLOSED |
| CLOSED | REOPENED | None |
| REOPENED | IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CANCELLED | RESOLVED, CANCELLED |
| CANCELLED | None; terminal | None |

| Other mutation | UI confirmation |
|---|---|
| Claim or first assignment from unassigned | No |
| Replace or remove an existing Ticket Owner | Yes; show old/new owner |
| Change IT Priority; append Comment/Note; indicate resolution | No |
| Soft-remove Attachment | Yes; include removal reason |
| Deactivate User; reset initial password | Yes; explain revoked sessions |
| Other User edits; password change | Explicit form submission |

Confirmation is interaction protection; the backend still enforces every business
rule when an API caller bypasses the UI.

## 6. UI Specification Summary

[ui-spec.md](ui-spec.md) defines Login, Change Password, the authenticated shell,
Create Ticket/My Tickets/Requester Detail, Staff Queue/Detail, and one minimalist
User Management screen with create/edit/reset modes. Desktop begins at 992px,
tablet spans 768–991px, and mobile is below 768px. Shared cards, forms, badges,
buttons, safe feedback, focus behavior, and viewport evidence extend Lab 2.

## 7. Data Changes

### Models, fields, and relationships

PostgreSQL remains the database and Prisma remains the schema/client. IDs are
positive autoincrementing `Int`; dates are Prisma `DateTime`; `?` means nullable.
New relationship foreign keys use `onDelete: Restrict` and `onUpdate: Cascade`,
except Session.userId uses `onDelete: Cascade`. Existing relationships and their
data remain valid. Product APIs provide no hard deletion.

| Model | Fields and constraints |
|---|---|
| User (replaces Requester) | `id Int PK`; `name String`; `email String UNIQUE` normalized lowercase; `isActive Boolean default true`; `role UserRole default REQUESTER`; `passwordHash String` holding an Argon2id encoded hash; `mustChangePassword Boolean default true`; preserved `createdAt DateTime default now()` and `updatedAt DateTime @updatedAt`. New/edited name/email limits are validated at the API; existing text storage is retained. |
| Session | `id Int PK`; `userId Int FK User`; `tokenHash String UNIQUE @db.Char(64)` (SHA-256 hex); `createdAt DateTime default now()`; `expiresAt DateTime`. No raw token, IP, password, or rolling expiry is stored. |
| Ticket (retained + extended) | Preserve `id`, unique `ticketNumber VarChar(32)`, `requesterId FK User`, `categoryId FK Category`, `relatedSystemId FK RelatedSystem`, `requestedPriority RequestedPriority`, `summary VarChar(200)`, `description VarChar(4000)`, `status TicketStatus`, `createdAt`, and `updatedAt`. Add `ownerId Int? FK User`, `itPriority RequestedPriority` required, and `resolutionIndicatedAt DateTime?`. |
| PublicComment | `id Int PK`; `ticketId Int FK Ticket`; `authorId Int FK User`; `body String @db.VarChar(2000)`; `createdAt DateTime default now()`. No update timestamp or edit/delete route. |
| InternalNote | `id Int PK`; `ticketId Int FK Ticket`; `authorId Int FK User`; `body String @db.VarChar(4000)`; `createdAt DateTime default now()`. Same append-only shape, separate table and authorization. |
| Category / RelatedSystem | Retain `id`, unique `name`, `isActive default true`, and `createdAt default now()` without replacing records. |
| Attachment | Retain `id`, `ticketId FK Ticket`, `originalName VarChar(255)`, unique `storageKey VarChar(64)`, `mimeType VarChar(100)`, `sizeBytes Int`, `createdAt`, nullable `removedAt`, and nullable `removalReason VarChar(500)`. Local files remain in the existing ignored upload directory. |

One User has many submitted tickets (`requester`) and separately many assigned
tickets (`owner`), sessions, authored Public Comments, and authored Internal
Notes. A Ticket has one submitting User, zero/one owner, one Category, one
Related System, and many Attachments/Comments/Notes. A submitted ticket retains
its historical User relationship even if that user's role later changes.

Use PostgreSQL/Prisma enums: `UserRole = REQUESTER | IT_STAFF | ADMINISTRATOR`;
reuse `RequestedPriority = LOW | MEDIUM | HIGH | URGENT` for both priorities;
extend `TicketStatus` with `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`,
`RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`, preserving `NEW`. Priority
ascending order is LOW, MEDIUM, HIGH, URGENT; status ascending order is the
matrix's row order. Explicit UI label maps replace the Lab 2 single-word formatter.

Indexes: retain Ticket(requesterId, updatedAt), Attachment(ticketId, removedAt),
and unique reference names/ticket numbers/storage keys. Add User(role, isActive,
name), retain User(isActive, name), Session(userId), Session(expiresAt),
Ticket(updatedAt, id), Ticket(ownerId, updatedAt), Ticket(status, updatedAt),
Ticket(categoryId), Ticket(requestedPriority), Ticket(itPriority), and separate
Comment/Note(ticketId, createdAt, id) and Comment/Note(authorId) indexes. Email
normalization is enforced with a database check (`email = lower(btrim(email))`)
and uniqueness. Lab-sized case-insensitive substring searches may scan; no
full-text/search service is introduced. Role/active-owner cross-row constraints
and last-admin protection require transactional service validation, not just FKs.

### Migration sequence and legacy initial passwords

1. Back up the local database and upload directory. On a populated Lab 2 copy,
   capture row counts, IDs, Ticket numbers, requester links, timestamps, and
   Attachment metadata/file checksums. Preflight normalized-email collisions;
   stop with a safe actionable report for manual correction rather than merge or
   drop people. Leave the old database usable if preflight fails.
2. During a local maintenance window, stop application writes. Rename/evolve
   Requester to User while preserving IDs, sequence ownership, names, activation,
   timestamps, and Ticket.requesterId FK targets. Add role REQUESTER and
   mustChangePassword true. Add passwordHash as nullable during backfill only.
   Normalize collision-free email addresses and add the normalization check.
3. Extend the status enum in a migration boundary before any fixture uses new
   values. Add nullable owner/indication fields and IT Priority, backfill
   itPriority from requestedPriority without changing existing Ticket.updatedAt,
   and then enforce its non-null constraint. Add Session, PublicComment,
   InternalNote, their FKs, and indexes.
4. Run the local credential bootstrap while the application remains stopped.
   Read `LAB3_LEGACY_INITIAL_PASSWORD` from an untracked local environment value,
   require the password rules, and hash it separately for each legacy User with
   a fresh Argon2id salt. Populate only missing hashes, including inactive users;
   preserve activation and require first-login change. Do not place the value
   in migration SQL, logs, client configuration, or source control. The local
   operator communicates it directly to the lab tester; there is no email flow.
5. Apply the follow-up migration making User.passwordHash non-null only after
   checking every backfill succeeded. This ordered expand/bootstrap/harden
   process is part of the migration command/runbook; do not run the hardening
   migration ahead of bootstrap. Runtime startup refuses an incomplete upgrade.
6. Verify preservation against the snapshot; apply the idempotent seed and run
   regression tests. Remove `/api/requesters`, selector routes/UI/types, and all
   identity inputs. Delete the obsolete `toktickit.requesterId` browser storage
   key during client initialization; it must never establish identity.

Rehearse both a populated upgrade and a clean database installation. Rollback
before reopening the application uses the explicit backup if necessary; never
use destructive reset commands to satisfy migration tests. Ordinary seed reruns
must not redo credential bootstrap or replace existing hashes.

### Idempotent local seed data

Keep the four active Lab 2 Requesters (Nicha Somchai, Anan Kittisak, Mali Charoen,
Preecha Wattanakul), inactive Suda, their `@toktickit.test` emails, and all four
Categories/six Related Systems. Add three active staff (`support.one`,
`support.two`, `support.three`), one inactive staff (`support.inactive`), and one
active Administrator (`admin`), each at `@toktickit.test`. Fixture names are
fictional. On a fresh seed each new account is marked for password change.

Use `LAB3_SEED_INITIAL_PASSWORD` for newly created local fixture accounts; its
documented development-only fallback is `Lab3-Initial-2026!`. This is a disposable
lab credential, never a real account secret. Legacy bootstrap uses its separate
required environment input and does not silently substitute the seed fallback.

Seed at least 24 realistic tickets using stable fixture Ticket Numbers, spread
across the four Requesters, all eight statuses, all four priorities, and assigned
and unassigned ownership. Include at least one resolution indication and public
comment, and one Internal Note without sensitive data. Use stable fixture IDs
or unique fixture keys for entries and advance sequences after explicit IDs.
Insert missing fixtures; updates for already-present fixtures are empty. Repeated
seeding preserves changed passwords, account state, tickets, attachments, and
authored entries and adds no duplicates. Required fixture counts apply to a
fresh installation; seed must not undo intentional administrative changes.

## 8. API Contract Summary

[api-spec.md](api-spec.md) specifies the exact auth, existing Requester/reference/
Attachment, shared Public Comment, resolution-indication, staff, and admin
endpoints. JSON uses explicit safe DTOs, not raw User/Session rows. Requester
ownership is session-derived. Staff Detail includes eligible owner choices so
staff can assign tickets without access to User Management.

## 9. Acceptance Criteria

| ID | Observable criterion |
|---|---|
| AC-01 | An active user with valid credentials receives safe identity and a new authenticated cookie; normalized email variants identify the same account. |
| AC-02 | Unknown, wrong-password, and inactive logins return the same failure; five failures trigger the documented next-attempt throttle, expiry clears it, and successful login clears its key. |
| AC-03 | A user required to change an initial password can access me/logout/change-password but no protected normal API or screen until a valid change succeeds. |
| AC-04 | Passwords of lengths 11/129 are rejected and 12/128 accepted without trimming; wrong current password, reuse, and mismatched UI confirmation do not change credentials. |
| AC-05 | Stored credentials are Argon2id hashes and sessions contain only SHA-256 token hashes; cookies have the required flags and safe responses expose neither hash nor token. |
| AC-06 | A session expires exactly eight hours after creation, logout invalidates it, and self-password change revokes previous sessions and issues one fresh session. |
| AC-07 | Unsafe requests with missing/null/foreign Origin fail; credentialed CORS grants only the configured origin and valid same-origin requests work. |
| AC-08 | Requester A cannot use supplied requesterId or obsolete selector state to act as B; identity inputs are rejected and `/api/requesters` no longer supplies identities. |
| AC-09 | Direct requests and routes obey every authorization-matrix row for Requester, IT Staff, Administrator, unauthenticated, and initial-password states. |
| AC-10 | Authenticated permitted users receive active Categories and Related Systems ordered by name; initial-password/unauthenticated users do not. |
| AC-11 | Valid Requester Ticket creation generates a unique number, authenticated requesterId, NEW status, copied IT Priority, no owner/indication, and backend timestamps; invalid fields/references cannot create a ticket. |
| AC-12 | My Tickets returns only submitted tickets with Lab 2 search/filter/sort/page behavior, all status filters, deterministic ordering, and empty/no-results feedback. |
| AC-13 | Own Ticket Detail is read-only to the Requester; missing and another Requester's Ticket/Attachment/Comment/indication requests are concealed by the same 404. |
| AC-14 | An owning Requester can upload/download and confirm soft removal with a reason; removed metadata persists and active-only download is enforced in every status. |
| AC-15 | Spoofed/unsupported/oversized/sixth attachments, invalid removal reasons, and concurrent limit violations fail safely; failed inserts remove any newly stored file. |
| AC-16 | Create form failures preserve values and file; if creation succeeds but upload fails, the saved ticket/official number remains and the UI offers a safe retry from Detail. |
| AC-17 | Any staff member finds queue matches by Ticket Number, Summary, and Requester name and combines Category, both priorities, status, and all/mine/assigned/unassigned filters. |
| AC-18 | Queue defaults to updatedAt descending and returns correct metadata for page sizes 10/20/50; every allowed sort has deterministic ID ties; invalid queries fail and beyond-end pages are empty. |
| AC-19 | Any staff member opens complete staff Detail, including tickets owned by other staff, read-only submitted fields, operational values, and active eligible owner choices. |
| AC-20 | Simultaneous claims on one unassigned ticket produce exactly one success and one conflict; claim sets the authenticated staff owner without changing status. |
| AC-21 | Assignment/reassignment/unassignment accepts only active staff/Admin owners, retains one owner, confirms replacement/removal in the UI, and prevents owner/account-change races. |
| AC-22 | Staff IT Priority edits change only IT Priority and updatedAt; Requester attempts are forbidden and Requested Priority retains its submitted value. |
| AC-23 | Every matrix transition succeeds for staff, every disallowed/same/unknown transition fails without mutation, required confirmations occur, and Cancelled has no outgoing transition. |
| AC-24 | An owning Requester records a backend resolution indication in allowed statuses without resolving/closing; repeat is idempotent, prohibited statuses conflict, and Reopened clears it. |
| AC-25 | Permitted users append/read Public Comments with trimmed 1–2000 character content, backend author/time, deterministic order, safe text rendering, and no edit/delete operation. |
| AC-26 | Staff append/read Internal Notes with trimmed 1–4000 character content; Requesters receive no note text/count through any payload or direct endpoint, and notes cannot be edited/deleted. |
| AC-27 | Staff/Admin can read Attachment metadata and download active files on any ticket; upload/removal attempts are forbidden and removed downloads fail. |
| AC-28 | Administrators list all users, search name/email, filter one role, and see Name, Email, Role, Status, and Edit; non-Administrators cannot access the list. |
| AC-29 | Administrator creation stores one valid role, normalized unique email, activation, and hashed initial password with required next-login change; invalid/duplicate input creates nothing. |
| AC-30 | Basic User edits update only permitted fields, retain one role and normalized uniqueness, and deactivation/role change invalidates prior sessions; reactivation requires a new login. |
| AC-31 | Self-deactivation, removal of the last active Administrator, and deactivation/any role change of an assigned owner return conflicts, including concurrent attempts, with all account/ticket data preserved. |
| AC-32 | Administrator initial-password reset stores a different hash, revokes all target sessions, and gates the target's next login behind password change; forbidden/invalid/reused resets leave credentials intact. |
| AC-33 | Validation, authorization, missing resources, conflicts, oversized bodies, type errors, throttling, and injected server failures return documented safe status/shape without protected data or secrets. |
| AC-34 | Login and Change Password display rules, validation, busy/disabled actions, generic inactive/invalid login feedback, safe failure, and successful role-appropriate continuation. |
| AC-35 | Authenticated Requester Create/List/Detail retain Lab 2 controls and Attachment states while adding Public Comments/resolution indication and removing Development Requester controls. |
| AC-36 | Staff Queue/Detail show documented query controls, owner/priority/status actions, distinct Public Comment/Internal Note composers, confirmations, and loading/empty/conflict/safe-failure states. |
| AC-37 | User Management supports list/create/edit/reset modes with labelled fields, one-role selection, confirmation, field errors, safe failures, and success feedback without excluded administration features. |
| AC-38 | The shell visibly shows current name/role and permitted navigation; reload validates the session, and logout/expiry/new login clears prior-user data and prevents direct protected access. |
| AC-39 | All major screens use shared Zen Green controls and labelled text badges, keyboard/focus feedback, and usable desktop/tablet/mobile layouts without clipping, overlap, or horizontal page overflow. |
| AC-40 | Populated migration preserves all required row identities, links, inactive states, Ticket timestamps, and Attachment files; copies priorities, sets legacy initial-password state, rejects normalized-email collisions, and also supports clean installation. |
| AC-41 | Fresh local seed provides at least 4 active/1 inactive Requesters, 3 active/1 inactive staff, 1 active Administrator, varied tickets/comments/notes; rerun adds no duplicates and preserves changed credentials and application data. |

## 10. Product Definition of Done

- All FRs, BRs, matrix rules, and ACs are implemented within included scope;
  approved contract changes are reflected in API/UI/test documents together.
- Populated and clean migration, credential bootstrap, preservation comparison,
  seed idempotence, and rollback procedure have reproducible evidence.
- Planned unit, migration/regression, API/integration, authorization/security,
  UI/style/responsive, and E2E checks pass on final `main`; both TypeScript builds
  pass. Each test result links an actual path and identifies the verified commit.
- Browser flows demonstrate invalid/inactive login, first-password change,
  logout, Requester ownership, staff queue/operations, private-note isolation,
  and Administrator safety/reset. Direct API denials are demonstrated.
- Desktop/tablet/mobile screenshots of major screens and required feedback
  states are stored under `artifacts/lab-03/screenshots/`; the visual checklist
  records actual inspection and responsive/accessibility outcomes.
- GitHub Issues progress through the existing Kanban states to Done; feature
  branches merge through reviewed PRs into `lab3-staging`, then through the
  release PR into `main`. Record real review identities, PR links, comments,
  responses, and approvals in [reviewer.md](reviewer.md).
- README documents local setup, migration/bootstrap order, test commands, and
  development credentials; `.gitignore` excludes env secrets, uploads, build
  output, and private tooling state. No real passwords or session secrets are
  committed.
- [ai-use.md](ai-use.md) records actual tools/models, 6–10 genuine selected
  prompts accumulated during the sprint, and an honest final reflection.
- One concise submission PDF uses “Answer Part 1” through “Answer Part 9” in
  order with working evidence links for workflow, Spec DD, Test DD, AI use,
  authentication, queue, staff Detail, administration, and responsive Zen Green.
  Repository `main` remains the source of truth; contract creation alone does
  not establish product completion.

## 11. Assumptions and Decisions

- Administrator staff capabilities are explicitly approved in this matrix;
  the two workspaces remain separate navigation destinations.
- The course app runs on one server process with a configured browser origin;
  in-memory throttling and local file storage are suitable lab constraints.
  Session state remains in PostgreSQL across server restarts.
- The fixed session duration, origin validation, Argon2id passwords, and hash-only
  session storage define the security implementation; no token is placed in
  browser local/session storage.
- Resolution indication is a repeat-safe Requester signal, never formal status.
  Staff ownership does not gate other staff's access. Submitted ticket fields
  remain read-only after creation.
- The existing `client/e2e/` location is retained for Lab 3 browser tests, with
  Playwright discovery extended to both labs; the handout's E2E directory example
  is adapted to this repository rather than duplicated at its root.
- Only four genuine user prompts are available at initial contract authoring;
  the AI-use log will grow through implementation to meet final submission
  requirements without inventing conversation or review evidence.
