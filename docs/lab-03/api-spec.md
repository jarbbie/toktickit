# Lab 3 REST API Contract

Base path `/api`. This contract supersedes Lab 2 identity inputs while retaining
its Requester Ticket/Attachment behavior. Roles, transitions, and validation
rules are defined in [specification.md](specification.md). All routes below are
the complete required surface; no staff user-directory endpoint is needed.

## 1. Transport, Authentication, and Validation

- JSON request/response bodies use `application/json`, except multipart uploads,
  downloaded bytes, and `204` responses. JSON parser limit is 100 KiB.
- Password hashing uses Argon2id with memory 65536 KiB, iterations 3,
  parallelism 1, and an independent random salt of at least 16 bytes per hash.
- Use an opaque `toktickit_session` cookie, `Path=/`, no Domain attribute,
  `HttpOnly`, `SameSite=Lax`, `Max-Age=28800`, with matching eight-hour Expires.
  `Secure` is required outside local development. The backend issues at least
  32 cryptographically random bytes encoded as base64url; only the SHA-256 hex
  hash is stored in Session. There is no bearer token response or browser
  storage token. Auth/user responses and protected data use `Cache-Control: no-store`.
- Session expires at `createdAt + 8 hours`, including initial-password sessions;
  GETs do not extend it. Expired/revoked/missing sessions and inactive users
  return `401 UNAUTHENTICATED`. Authentication reads current User state/role on
  every request. Password-change gating returns `403 PASSWORD_CHANGE_REQUIRED`
  except for me, logout, and change-password.
- `CLIENT_ORIGIN` is an exact configured origin such as
  `http://127.0.0.1:5173`. Credentialed CORS grants that origin only, includes
  `Vary: Origin`, and permits the documented methods and Content-Type.
  Preflight OPTIONS performs no mutation and needs no session. Never use `*`
  with credentials. Client fetches use `credentials: "include"`; download links
  use the same cookie-bearing API host.
- For authenticated POST/PATCH/DELETE, require Origin equal to CLIENT_ORIGIN;
  missing, `null`, or different Origin yields `403 ORIGIN_FORBIDDEN`. Login has
  the same check before credential verification to prevent login CSRF. Protected
  mutations authenticate before this check, so no session still returns 401.
  Logout without a valid session simply clears the cookie and returns 204.
- Validate positive integer IDs within PostgreSQL Int range (1–2147483647).
  Query integers must be decimal strings and pagination offset must be safely
  representable. Reject repeated parameters/arrays, unknown fields/queries,
  wrong types, invalid enums, and obsolete `requesterId` input with `400`.
  Omitted optional filters mean no filter; empty search is allowed; empty enum
  filters must be omitted. Trim text except passwords. Text lengths follow
  JavaScript string length on both client and server; password equality compares
  the exact submitted string against the existing hash.
- Authorize role before looking up a role-restricted resource. For an authorized
  Requester, scope lookup by authenticated User ID and return the same 404 for
  missing/foreign-owned resources. Validate target state and apply related
  writes atomically; rejected mutations leave persisted state unchanged.
- `/api/health` remains public with `200 { status: "ok", service: "TokTickIT API" }`.
  Removed or unsupported routes, including `/api/requesters` and entry update/
  deletion paths, return safe JSON 404. A role-restricted prefix may reject a
  forbidden user before an unsupported route is reached; no protected data leaks.

## 2. Response Shapes

These structural shapes define JSON fields, not executable implementation.
`Timestamp` is an ISO 8601 UTC string. All IDs are numbers. Nullable fields are
present as `null`. Enum strings use the exact values in the specification.
No response includes passwordHash, tokenHash, session token, storageKey, or
internal server details.

```text
Reference = { id, name }
UserIdentity = { id, name, email, role, isActive, mustChangePassword }
UserRecord = UserIdentity + { createdAt, updatedAt }
Person = { id, name }
Owner = { id, name, role }                       // eligible staff role
AuthResult = { user: UserIdentity, expiresAt: Timestamp }

Attachment = {
  id, originalName, mimeType, sizeBytes, createdAt,
  removedAt: Timestamp | null, removalReason: string | null
}

TicketRecord = {
  id, ticketNumber, requesterId, categoryId, relatedSystemId,
  summary, description, requestedPriority, itPriority, status,
  ownerId: number | null, resolutionIndicatedAt: Timestamp | null,
  createdAt, updatedAt
}
TicketListItem = {
  id, ticketNumber, summary, requestedPriority, itPriority, status,
  category: Reference, createdAt, updatedAt
}
TicketDetail = TicketRecord + {
  requester: Person, category: Reference, relatedSystem: Reference,
  owner: Owner | null, attachments: Attachment[]
}
StaffQueueItem = TicketListItem + {
  requester: Person, owner: Owner | null,
  resolutionIndicatedAt: Timestamp | null
}
StaffTicketDetail = TicketDetail + { ownerOptions: Owner[] }

Page<T> = { items: T[], page, pageSize, totalItems, totalPages }
PublicComment = { id, ticketId, body, author: Person, createdAt }
InternalNote = { id, ticketId, body, author: Person, createdAt }
```

Requester detail and lists contain no Internal Notes or note count. Fetch Public
Comments and Internal Notes separately through their authorized endpoints.
Attachments in detail include active and removed metadata, ordered createdAt
descending then id descending. Owner options contain only active IT Staff and
Administrators, ordered name ascending then id ascending, with no email or
credential fields. This supplies staff assignment controls without exposing
Administrator User Management.

## 3. Authentication

### `POST /api/auth/login`

Body: `{ "email": "admin@toktickit.test", "password": "Lab3-Initial-2026!" }`.
The sample is a disposable local seed credential. Trim/lowercase email; validate
email syntax/maximum 254 and password length 12–128 without trimming. No role,
activation, identity, or password-change state can be supplied.

`200` sets a fresh session cookie and returns AuthResult. If an existing valid
session cookie accompanies login, invalidate that session before replacing it.
`user.mustChangePassword` determines whether the client must show Change
Password. Normalized-email/IP rate-limit key uses the observed network peer IP
in local mode; do not trust arbitrary forwarded-IP headers.

Well-formed invalid credentials, missing accounts, and inactive accounts all
return `401 { error: "Unable to sign in. Check your credentials or contact an administrator.",
code: "INVALID_CREDENTIALS" }`. Use equivalent password verification work for
unknown/inactive accounts without revealing account existence. Count these
credential failures in a fixed 15-minute window starting at the first failure.
Five failures are allowed; subsequent attempts in the window return
`429 LOGIN_THROTTLED` and integer `Retry-After` seconds remaining, even if their
password is correct. Reset at expiry or successful authentication before the
threshold. Invalid request shape returns 400, not a credential attempt.

The limiter is intentionally in memory: restart loses counters and distributed
processes would need shared storage. Login has no email delivery/unlocking flow.

### `POST /api/auth/logout`

No request body. Delete the current session if it exists; return `204` with an
empty body and clear `toktickit_session` using the same Path/flags, Max-Age 0,
and expired Expires. Missing/expired cookies also return 204. Authenticated
logout requires the configured Origin. An unexpected deletion failure returns
safe 500; the client must not report successful server invalidation on failure.

### `GET /api/auth/me`

No query/body. `200 AuthResult` for any valid active session, including a user
who must change their password; otherwise 401. Return current database identity
and the existing fixed session expiry. This endpoint is the client's session
bootstrap and reload check, not a list of accounts.

### `POST /api/auth/change-password`

Body: `{ "currentPassword": "Lab3-Initial-2026!", "newPassword": "My-New-Lab3-Pass!" }`.
Both strings obey the password limits without trimming. Verify currentPassword;
reject reuse of the current/initial password. Confirmation is validated in the UI
and is not a request field. A wrong current password returns `400` with
`fieldErrors.currentPassword`; invalid/reused new password returns 400 with
`fieldErrors.newPassword`. Invalid session returns 401.

Atomically hash/save the new password, set mustChangePassword false, revoke all
existing User sessions, and issue one fresh eight-hour session for this request.
`200 AuthResult` sets the replacement cookie. Failure cannot partly change a
password and leave old sessions active.

## 4. Authenticated Reference and Requester APIs

### `GET /api/categories`; `GET /api/related-systems`

All three roles after password change. No parameters. `200 Reference[]` of
active records ordered name ascending then id ascending; safe 500 on failure.
Existing tickets still display their linked reference even if it becomes inactive.

### `POST /api/tickets`

Requester only. Body:

```json
{
  "categoryId": 1,
  "relatedSystemId": 3,
  "requestedPriority": "MEDIUM",
  "summary": "VPN cannot connect",
  "description": "The VPN disconnects immediately after successful sign-in."
}
```

Priority is optional with default MEDIUM. Trim Summary 5–200 and Description
10–4000; references must exist and be active. `201 TicketRecord` uses
requesterId from session, NEW status, itPriority equal to requestedPriority,
null owner/indication, and server timestamps/unique Ticket Number. Retry the
existing number generator on collision, up to three attempts; exhausted retry
is a safe 500 with no extra ticket. Invalid input/reference is 400.

Upload the optional file separately after creation. A later upload error never
rolls back or re-creates the ticket; the UI shows the saved ticket and safe warning.

### `GET /api/tickets`

Requester only. Query:

```text
search, categoryId, requestedPriority, status,
sortBy=updatedAt|createdAt|ticketNumber|requestedPriority,
direction=asc|desc, page=1, pageSize=5|10|20
```

Default `sortBy=updatedAt&direction=desc&page=1&pageSize=10`. Search is trimmed,
case-insensitive substring matching Ticket Number OR Summary, maximum 200
characters. Filters combine with AND within authenticated requesterId; all eight
statuses are allowed. `200 Page<TicketListItem>`; invalid query is 400. Preserve
ID secondary ordering in the same direction, priority semantic order, and
`totalPages=ceil(totalItems/pageSize)` (0 when empty). Positive page beyond the
last page returns empty items and actual totals, not a clamp. Missing referenced
filter IDs yield no matches; malformed IDs are rejected.

### `GET /api/tickets/:ticketId`

Requester only; no query/body. `200 TicketDetail` for an owned ticket. Missing or
foreign-owned ticket: `404 { error: "Ticket not found.", code: "NOT_FOUND" }`.
Submitted fields are read-only; no Ticket update/delete endpoint is provided.

## 5. Attachments

### `POST /api/tickets/:ticketId/attachments`

Requester only, owned ticket, any status. `multipart/form-data` contains exactly
one `file` and no identity field. Original filename length 1–255; allowed types
image/jpeg, image/png, image/webp, application/pdf with matching signatures;
maximum 5 MiB (5 × 1024 × 1024 bytes); maximum five active files per ticket.

`201 Attachment`. Missing file/malformed upload is 400, missing/unowned ticket
404, active-count conflict 409, oversized file 413, unsupported/mismatched type
415, unexpected failure safe 500. Authenticate/authorize before processing
uploads. Serialize limit check and insertion with ticket-scoped locking and
remove any newly written file if database insertion fails. Staff/Admin receive
403 even if they own the operational ticket.

### `GET /api/attachments/:attachmentId`

Requester own ticket or any staff. No query/body. `200 Attachment`, including
removed metadata; missing/Requester foreign-owned attachment returns 404.

### `GET /api/attachments/:attachmentId/download`

Same reader permissions; active attachment required. `200` streams bytes with
the recorded Content-Type, safe `Content-Disposition: attachment` filename, and
`X-Content-Type-Options: nosniff`. Missing/removed/foreign-owned is 404. Unexpected
storage/database error is safe 500 before headers; after streaming begins abort
the failed stream without writing an HTML/JSON stack trace into it.

### `DELETE /api/attachments/:attachmentId`

Requester only; body `{ "reason": "Uploaded the wrong screenshot" }`. Trim
reason to 1–500 characters. For an active own attachment, set removedAt/reason
and return `200 Attachment`; metadata and underlying local file are retained.
UI confirmation is required. Missing/already removed/foreign-owned is 404;
invalid reason is 400. Staff/Admin receive 403. No requesterId parameter remains
in upload, metadata, download URL, or removal.

## 6. Shared Public Comments and Resolution Indication

### `GET /api/tickets/:ticketId/public-comments`

Owning Requester or any staff. No query/body. `200 PublicComment[]`, including
an empty array, ordered createdAt ascending then id ascending. A Requester must
pass the ticket ownership check; missing/concealed ticket is 404.

### `POST /api/tickets/:ticketId/public-comments`

Same permissions, all statuses. Body `{ "body": "The connection works after restarting." }`.
Trim to 1–2000 characters. `201 PublicComment` with backend author/time; update
Ticket.updatedAt in the same transaction. Invalid text is 400. Client authorId,
createdAt, HTML interpretation, update, and delete are unsupported.

### `POST /api/tickets/:ticketId/resolution-indication`

Owning Requester only; no body. Allowed statuses: NEW, OPEN, IN_PROGRESS,
WAITING_FOR_REQUESTER, REOPENED. First call records backend time; repeats in an
allowed status return the existing value without changing Ticket.updatedAt.
`200 { ticketId, resolutionIndicatedAt, status, updatedAt }`. Status is unchanged.
RESOLVED, CLOSED, CANCELLED return 409; staff roles return 403; missing/concealed
ticket is 404. A later staff transition to REOPENED clears the timestamp.

## 7. IT Staff Queue and Ticket Operations

Every endpoint here permits IT_STAFF and ADMINISTRATOR for all tickets,
irrespective of the Ticket Owner. Requester receives 403 before ticket lookup.

### `GET /api/staff/tickets`

```text
search, categoryId, requestedPriority, itPriority, status,
ownership=all|mine|assigned|unassigned,
sortBy=updatedAt|createdAt|ticketNumber|requestedPriority|itPriority|status,
direction=asc|desc, page=1, pageSize=10|20|50
```

Defaults: empty search/no filters, ownership all, sortBy updatedAt, direction
desc, page 1, pageSize 10. Search trims to at most 200 characters and matches
Ticket Number OR Summary OR Requester name, case-insensitively. Filter values
are positive Category IDs or specified enums. AND-combine all selected filters;
mine means ownerId equals the current User ID, assigned means non-null ownerId,
unassigned means null. Current status includes all eight values.

`200 Page<StaffQueueItem>` with totalItems counting matching tickets. Priority
sort uses LOW/MEDIUM/HIGH/URGENT; status sort follows the matrix's row order.
Every sort adds id in the same direction as a tie breaker. Query arrays,
unsupported fields/sorts/directions/page sizes, and invalid numeric values
return 400. Beyond-end positive pages and no-match totals follow the Requester
list rules. Retrieve items and totals from one consistent database snapshot.

### `GET /api/staff/tickets/:ticketId`

No query/body. `200 StaffTicketDetail`, including eligible ownerOptions. Fetch
comments and notes from the separate endpoints. Missing ticket is 404. This
shape includes read-only submitted fields, active and removed Attachments,
ownership, both priorities, status, and resolution indication.

### `POST /api/staff/tickets/:ticketId/claim`

No body. Atomically assign current authenticated staff User only if ownerId is
null and the current User remains eligible. `200 StaffTicketDetail`. Already
assigned, including to self, is `409 TICKET_ALREADY_ASSIGNED`; missing is 404.
Do not update status. Concurrent claims must have exactly one winner.

### `PATCH /api/staff/tickets/:ticketId/owner`

Body `{ "ownerId": 8 }` or `{ "ownerId": null }` to unassign. Required field;
no author or requester identity input. `200 StaffTicketDetail`. Missing ticket
404; malformed ownerId 400; nonexistent/inactive/non-staff target
`409 OWNER_UNAVAILABLE`. The same owner is an idempotent success without an
updatedAt change. Lock/check owner eligibility with assignment and account
updates. Confirm replacing/removing an existing owner in the UI.

### `PATCH /api/staff/tickets/:ticketId/it-priority`

Body `{ "itPriority": "HIGH" }`. Required allowed priority; `200 StaffTicketDetail`.
Invalid enum 400, missing ticket 404. Same value is an idempotent success;
actual change updates updatedAt but never Requested Priority or status.

### `PATCH /api/staff/tickets/:ticketId/status`

Body `{ "status": "IN_PROGRESS" }`. Required enum; `200 StaffTicketDetail`.
Apply only a transition permitted from the persisted current state in the
specification matrix. Unknown status 400; disallowed or same-state transition
`409 INVALID_STATUS_TRANSITION`; missing ticket 404. Transition to REOPENED
clears resolutionIndicatedAt atomically. UI confirmation precedes transitions
to RESOLVED, CLOSED, or CANCELLED. No claim requirement or Actions Taken check.

### `GET /api/staff/tickets/:ticketId/internal-notes`

No query/body. `200 InternalNote[]`, ordered createdAt ascending then id
ascending; empty array if none. Missing ticket 404. Requester 403 response
reveals neither whether the ticket exists nor any note count/content.

### `POST /api/staff/tickets/:ticketId/internal-notes`

Body `{ "body": "Reproduced the VPN disconnect using the local test account." }`.
All statuses; trim 1–4000 characters; `201 InternalNote` with server author/time
and atomic Ticket.updatedAt change. Invalid text 400; missing ticket 404.
There are no note edit/delete endpoints.

## 8. Administrator User Management

ADMINISTRATOR only; other roles receive 403 before looking up users. No
deletion, bulk, import/export, audit-history, or email endpoints are included.

### `GET /api/admin/users`

Optional `search` (trimmed, maximum 200 characters; case-insensitive substring
of name OR email) and `role=REQUESTER|IT_STAFF|ADMINISTRATOR`. Combine search and
one role filter. `200 UserRecord[]`, all activation states, ordered name ascending
then id ascending. No pagination or multi-column sort. Empty list is `[]`;
unknown/invalid queries return 400. Credential and Session fields are excluded.

### `POST /api/admin/users`

```json
{
  "name": "Support One",
  "email": "support.one@toktickit.test",
  "role": "IT_STAFF",
  "isActive": true,
  "initialPassword": "Lab3-Initial-2026!"
}
```

All five fields are required. Name trimmed 1–100; normalized email syntactically
valid and ≤254; exactly one role; isActive Boolean; password 12–128 without
trimming. `201 UserRecord`, mustChangePassword true. Hash before storing and
never echo the password. Invalid input is 400; normalized duplicate email,
including a concurrent create, is `409 EMAIL_IN_USE` with fieldErrors.email.
The operator already knows the submitted initial password and communicates it
directly for the local lab; no password retrieval/delivery mechanism exists.

### `PATCH /api/admin/users/:userId`

Body contains at least one of `{ name, email, role, isActive }`, using the same
validation as creation; omitted fields retain their values. Unknown fields,
initialPassword, role arrays, and empty bodies return 400. `200 UserRecord`;
missing user 404; duplicate email 409.

Transactional safety conflicts return 409 and do not change any field:

| Code | Condition |
|---|---|
| SELF_DEACTIVATION | Acting Administrator sets their own isActive false |
| LAST_ACTIVE_ADMINISTRATOR | Change would remove the last active Administrator through role change/deactivation |
| ASSIGNED_TICKET_OWNER | User is assigned any ticket and is being deactivated or has any actual role change |

Check in this order for deterministic errors when multiple rules apply.
Serialize affected User/assignment writes and active-admin invariant checks;
two concurrent demotions/deactivations must not remove all administrators.
Changing a submitted ticket's Requester role does not remove its historical
relationship. Role change or deactivation deletes all target sessions in the
same transaction; a self-role change returns the edited record and the next
protected request requires login. The UI clears its session immediately in
that case. Reactivation does not resurrect sessions or clear password-change state.

### `POST /api/admin/users/:userId/initial-password`

Body `{ "initialPassword": "Replacement-Lab3-Pass!" }`; 12–128, untrimmed and
different from the user's current/initial password. `200 UserRecord` with
mustChangePassword true. Atomically save the hash and revoke all target
sessions. Unknown user 404; invalid/reused password 400. Inactive accounts may
receive a reset but remain inactive. UI confirmation explains session
revocation and required next-login change. Self-reset is allowed; clear the
acting user's cookie/client identity and return to Login after success.

## 9. Safe Errors and Failure Feedback

General shape:

```json
{
  "error": "Please correct the highlighted fields.",
  "code": "VALIDATION_ERROR",
  "fieldErrors": { "summary": "Summary must contain 5–200 characters." }
}
```

`error` is always a safe human-readable string. `code` is an optional stable
machine-readable string except where explicitly named above; `fieldErrors` is
an optional map from documented input name to safe string. Do not return
submitted passwords as message text. Keep general 500 messages specific to
the attempted operation without exposing the underlying exception.

| Status | Use |
|---|---|
| 200 | Retrieval, password change/login, successful patch/indication/reset/soft removal |
| 201 | Ticket, Attachment, Public Comment, Internal Note, or User creation |
| 204 | Logout, no JSON body |
| 400 | Malformed JSON, invalid/unknown fields or queries, unsupported enum, wrong current/reused new password |
| 401 | Missing/expired/revoked session or generic login failure |
| 403 | Wrong role, required password change, or forbidden Origin |
| 404 | Missing resource, concealed Requester-owned resource, or unsupported route |
| 409 | Duplicate email, assignment/attachment-limit/account-safety conflict, or invalid transition/indication state |
| 413 | JSON over 100 KiB or file over 5 MiB |
| 415 | Unsupported/spoofed attachment content type |
| 429 | Login limiter; include Retry-After |
| 500 | Unexpected database, storage, hashing, or server failure with safe JSON |

Authorization refusals return no protected record or count. Missing/foreign-owned
Ticket uses “Ticket not found.”; missing/removed/foreign-owned download uses
“Attachment not found.”. A Requester Internal Note request always receives
generic “Access denied.” before lookup. Server logs may record operational
failure context but must redact passwords, session cookies, and token/hash data.
