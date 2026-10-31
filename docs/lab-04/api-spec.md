# Lab 4 REST API Contract

**Status:** Engineering contract reviewed and merged through PR #76 for Issue
#67. Actions Taken implementation is tracked in #69; other Lab 4 endpoints
remain tracked by their respective issues. Base path is /api. Existing Labs 1–3 routes and cookie-session,
Origin/CSRF, password-change, safe-error, and no-store rules remain in force.

## 1. Shared Rules

- JSON request/response bodies use application/json. No Action file upload is
  introduced; Attachment Notes are ordinary text.
- All protected mutations require the configured Origin. Client requests use
  credentials: include. Auth, dashboard, Action, and Ticket responses use
  Cache-Control: no-store.
- Validate IDs as positive PostgreSQL Int values. Reject unknown query/body
  fields, arrays where scalars are expected, wrong types, invalid enum values,
  invalid timestamps, and malformed UUIDs with 400.
- Authorize the role before looking up a role-restricted resource. For
  Requesters, include authenticated requesterId in the query and return the same
  404 for missing and foreign-owned Ticket resources.
- The backend supplies actor/performer names, roles, IDs, timestamps, and
  workflow state. Never trust client-supplied user identity, role, owner, or
  performer.
- Error shape: { error, code?, fieldErrors? }. Use 401 unauthenticated,
  403 forbidden/origin/password gate, 404 absent or concealed Ticket,
  400 malformed/invalid input, 409 stale/illegal/non-actionable/ineligible/
  replayed-conflict, and safe 500. Do not expose SQL, stack traces, hashes,
  session tokens, storage keys, or private Action snapshots.
- Timestamp responses are ISO 8601 UTC. The UI converts Asia/Bangkok local
  date/time to an explicit-offset timestamp before sending.
- Every Action mutation and Ticket status transition runs in a database
  transaction against the same parent Ticket lock/workflowVersion. Check the
  expected version and current Ticket status after acquiring that lock. Action
  writes require an actionable parent status as defined below, so resolution,
  cancellation, and Action writes cannot race. Failed transactions write no
  partial Action, Ticket, version, timestamp, or event state.
- Requester and support Ticket detail responses include `workflowVersion`.
  Support clients refresh Ticket detail to obtain the current token before
  an Action mutation. Missing concurrency tokens return the corresponding
  409 stale-version code; malformed token types or values return 400.
- Browser CORS requests may send `Idempotency-Key`, and may read the
  `Idempotent-Replayed` response header.

## 2. Response Shapes

~~~text
Person = { id, name, role }
RequesterSummary = { id, name }
ActionRecord = {
  id, ticketId, actionAt, description, result: string | null,
  performedBy: Person, assignee: Person | null, status,
  followUpRequired, followUpNote: string | null,
  attachmentNotes: string | null, version, createdAt, updatedAt
}
ActionSnapshot = {
  actionAt, description, result: string | null, performedBy: Person,
  assignee: Person | null, status, followUpRequired,
  followUpNote: string | null, attachmentNotes: string | null, version
}
ActionEvent = {
  id, actionId, actor: Person,
  type: CREATED | EDITED | ASSIGNED | STATUS_CHANGED,
  before: ActionSnapshot | null, after: ActionSnapshot,
  createdAt
}
RequesterActionRecord = ActionRecord
SupportActionRecord = ActionRecord & { events: ActionEvent[] }
TicketStatusEvent = {
  id, ticketId, fromStatus, toStatus, actor: Person, changedAt
}
RequesterDashboardTicket = {
  id, ticketNumber, summary, status, itPriority,
  updatedAt, resolvedAt?: string | null, href
}
StaffDashboardTicket = {
  id, ticketNumber, summary, requester: RequesterSummary, status, itPriority,
  owner: Person | null, updatedAt, href
}
RequesterDashboard = {
  asOf, windowStart,
  counts: {
    openTickets: { count, href },
    waitingForRequester: { count, href },
    recentlyResolved: { count, href }
  },
  recentlyUpdated: RequesterDashboardTicket[],
  recentlyResolvedTickets: RequesterDashboardTicket[]
}
StaffDashboard = {
  asOf, windowStart,
  counts: {
    unassignedOpen: { count, href },
    ownedByMeOpen: { count, href },
    byStatus: [{ status, count, href }],
    byITPriority: [{ itPriority, count, href }]
  },
  recentlyUpdated: StaffDashboardTicket[],
  urgentTickets: StaffDashboardTicket[]
}
~~~

The support-user `GET /api/tickets/:ticketId/actions` response nests each
Action's ordered events in `events`; there is no separate Action-event route.
Requester reads and every Action mutation response contain current Action
fields only. The UI refreshes the support read after a successful mutation to
show the new event. `ActionSnapshot` is an allowlist of Action fields and never
contains idempotency keys, fingerprints, Internal Notes, or hidden account
fields. Requester dashboard rows omit Staff owner identity. Each
`StaffDashboardTicket` includes only the Requester's `id` and display `name`,
not email or other account fields. Ticket status history contains status
changes only; it never includes Internal Notes.

## 3. Dashboard Drill-Down Filters on Existing Ticket Lists

The existing `GET /api/tickets` and `GET /api/staff/tickets` keep their Lab 3
filters and add the following optional filters so dashboard links reproduce
the dashboard population. All date filters accept ISO 8601 timestamps with an
explicit offset and include records at the boundary (`>=`). Existing filters
continue to combine with AND.

| Filter | Requester list | Staff queue | Meaning |
|---|---|---|---|
| `statusGroup=open` | Yes | Yes | NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, REOPENED |
| `statusGroup=resolved` | Yes | No | Currently RESOLVED or CLOSED |
| `updatedAfter=<timestamp>` | Yes | Yes | `updatedAt >= timestamp` |
| `resolvedAfter=<timestamp>` | Yes | No | Latest recorded transition into RESOLVED has `changedAt >= timestamp`; requires `statusGroup=resolved` |
| `itPriorityGroup=high_or_urgent` | No | Yes | IT Priority is HIGH or URGENT |

`statusGroup` cannot be combined with `status`. `resolvedAfter` is valid only
for a Requester with `statusGroup=resolved`; the latest status event entering
RESOLVED determines `resolvedAt`. `itPriorityGroup` cannot be combined with
`itPriority`. Requester scope still comes from the session in every query.
Unknown, repeated, array-valued, malformed, or incompatible filters return
400. A resolved-group list item includes `resolvedAt` (ISO UTC or null for a
legacy Ticket without a recorded resolution event).

The additional sorts are `sortBy=resolvedAt` for a Requester list with
`statusGroup=resolved` (descending resolution time, then ID descending) and
`sortBy=urgentWork` for a Staff queue with
`statusGroup=open&itPriorityGroup=high_or_urgent` (URGENT before HIGH, then
oldest `updatedAt`, then ID ascending). Existing sort defaults are unchanged.
Dashboard links pass `windowStart` as the lower-bound timestamp and use these
sorts where applicable.

## 4. Actions Taken

### GET /api/tickets/:ticketId/actions

No query or body. Requester may read only an owned Ticket; IT Staff/Admin may
read any existing Ticket. Return 200 with `RequesterActionRecord[]` for a
Requester or `SupportActionRecord[]` for IT Staff/Admin. Both arrays are
ordered by `actionAt` ascending, then Action ID ascending. A Ticket with no
Actions returns `[]`. Each support record's `events` array contains that
Action's append-only events ordered by `createdAt` ascending, then event ID
ascending. Requester records have no `events` property or event snapshots.
Missing or foreign-owned Ticket is 404. A Requester write role receives 403
on staff-only route prefixes before lookup.

### Parent Ticket state required for Action writes

Create, edit, assignment, and status-change requests require the current parent
Ticket status to be NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, or REOPENED.
Check this after locking the Ticket and before writing. RESOLVED or CLOSED
Tickets must first be moved to REOPENED through the Ticket workflow; CANCELLED
Tickets are terminal and cannot accept further Action writes. Reject a blocked
write with 409 `ACTION_TICKET_NOT_MUTABLE`; do not change an Action, its version,
the Ticket workflowVersion/updatedAt, or event history. This check applies to
content edits as well as assignment and lifecycle changes, so no Action can
restore active work or follow-up on a non-actionable Ticket. A verified exact
create idempotency replay (same key, actor, Ticket, and payload) is read-only
and may return the previously created Action even if its parent later changed
status; resolve this replay before checking current parent status/version and
write no state.

### POST /api/staff/tickets/:ticketId/actions

Support roles only. Body:

~~~json
{
  "actionAt": "2026-10-14T09:30:00+07:00",
  "description": "Inspect the affected access point.",
  "assigneeId": 24,
  "followUpRequired": false,
  "followUpNote": null,
  "attachmentNotes": "Requester mentioned a photo in the ticket attachments.",
  "expectedWorkflowVersion": 3
}
~~~

assigneeId and attachmentNotes may be null/omitted. actionAt, description,
followUpRequired, and expectedWorkflowVersion are required. Follow-up Note is
required and trimmed 1–1000 characters when followUpRequired=true; otherwise
the stored current note is null. Description is trimmed 1–2000. Attachment
Notes are optional, trimmed, at most 1000. Initial status is PLANNED, result is
null, version is 1, and performedBy is the authenticated actor.

Require an Idempotency-Key header containing a globally unique UUID. Store its
payload fingerprint and authenticated actor with the Action. 201 ActionRecord
for a new Action. In the same transaction, create a CREATED ActionEvent,
increment the Ticket workflowVersion, and update Ticket.updatedAt. An exact
replay by the same actor returns 200 with the existing current Action and
Idempotent-Replayed: true; a replay never changes versions, timestamps, or
events. Reuse with a different actor/payload returns
409 IDEMPOTENCY_KEY_REUSED. Missing/invalid key is 400; inactive or
non-support assignee is 409 ACTION_ASSIGNEE_UNAVAILABLE; stale
expectedWorkflowVersion is 409 STALE_TICKET_WORKFLOW; missing Ticket is 404.

### PATCH /api/staff/actions/:actionId

Support roles only. Body includes expectedVersion and expectedWorkflowVersion
plus one or more of actionAt, description, result, followUpRequired,
followUpNote, attachmentNotes. Ticket ID, action ID, performer, creator, status,
version, and event actor are not writable fields. Validate all resulting field
values as one new Action state; when followUpRequired=false clear the current
followUpNote. A Result is optional until completion and at most 2000 characters.

Return 200 ActionRecord. Append one ActionEvent with actor, before/after
snapshot, and server time; increment Action.version and Ticket.workflowVersion;
update Ticket.updatedAt in the same transaction. 400 field errors for invalid
values, 404 missing Action/Ticket, 409 STALE_ACTION or STALE_TICKET_WORKFLOW.
No Action delete route exists.

### PATCH /api/staff/actions/:actionId/assignee

Body: { "expectedVersion": 1, "expectedWorkflowVersion": 3, "assigneeId": 24 }
or assigneeId:null to unassign. Only PLANNED or IN_PROGRESS Actions can be
reassigned. Target must be active IT Staff/Admin. A successful change returns
200 ActionRecord, increments Action.version and Ticket.workflowVersion,
updates Ticket.updatedAt, and appends ASSIGNED ActionEvent in the same
transaction. Missing Action/Ticket is 404; invalid/inactive
target is 409 ACTION_ASSIGNEE_UNAVAILABLE; terminal Action is
409 ACTION_TERMINAL; stale versions use 409. A repeated same-assignee write is
an idempotent 200 with no version/event/timestamp change. UI confirms replacing
or removing an existing assignee.

### PATCH /api/staff/actions/:actionId/status

Body: { "expectedVersion": 1, "expectedWorkflowVersion": 3,
"status": "IN_PROGRESS" }. Allowed values are IN_PROGRESS, COMPLETED,
CANCELLED; transitions follow the Action matrix in specification.md. When
status=COMPLETED, trimmed Result is required (1–2000). Cancellation has no
required reason; UI requires confirmation. A successful change returns 200
ActionRecord, increments Action.version and Ticket.workflowVersion, updates
Ticket.updatedAt, and appends STATUS_CHANGED event in the same transaction.
Illegal/same status is 409 INVALID_ACTION_TRANSITION;
completion without Result is 400; stale versions are 409. COMPLETED/CANCELLED
cannot transition again.

## 5. Ticket Workflow and Status History

### PATCH /api/staff/tickets/:ticketId/status

Extends the Labs 3 endpoint. Body:
{ "status": "RESOLVED", "expectedWorkflowVersion": 4 }.
IT Staff/Admin only. Validate status enum, expected version, matrix, and
resolution/cancellation gates against persisted state within one transaction.
On success update Ticket, increment workflowVersion, update updatedAt, append
TicketStatusEvent, and return 200 StaffTicketDetail with the new version/status.
No transition requires Ticket ownership.

Responses:

- 400 invalid body/status/version.
- 401 no valid session.
- 403 Requester, initial-password gate, or invalid Origin.
- 404 missing Ticket.
- 409 INVALID_STATUS_TRANSITION for same/forbidden transition.
- 409 RESOLUTION_BLOCKED with safe counts of active Actions/follow-ups when the
  proposed resolution gate fails.
- 409 CANCELLATION_BLOCKED when active Actions remain.
- 409 STALE_TICKET_WORKFLOW when the expected workflow version is old.
- 500 generic safe error.

No update or event is written for a rejected transition. Transition to REOPENED
clears resolutionIndicatedAt atomically, preserving Lab 3 behavior.

### GET /api/tickets/:ticketId/status-events

No query/body. Owning Requester and support users can read. Return 200
TicketStatusEvent[] ordered changedAt ascending then event ID ascending. A
Requester sees only their Ticket. Missing/foreign Ticket is 404. Requester
resolution indication is not a status event. No create/update/delete event
route exists.

## 6. Dashboards

Both dashboard endpoints reject query parameters and return only the documented
counts and short summaries.

### GET /api/requester/dashboard

Requester only. The server derives requesterId from the session. Return
RequesterDashboard with:

- openTickets: count of own Tickets in NEW, OPEN, IN_PROGRESS,
  WAITING_FOR_REQUESTER, REOPENED.
- waitingForRequester: own Tickets in WAITING_FOR_REQUESTER.
- recentlyUpdated: at most 5 own Tickets updated in the last 7 Asia/Bangkok
  calendar days, updatedAt descending then id descending.
- recentlyResolved: count and at most 5 own Tickets currently RESOLVED/CLOSED
  whose latest transition into RESOLVED is inside the same window, ordered by
  resolution event time descending then id descending.
- windowStart is local midnight six calendar days before the date containing
  asOf; asOf is the server request time. Both serialize UTC.
- Empty arrays and zero counts are explicit. Legacy Tickets with no Lab 4
  transition event have no fabricated resolution date and are absent from the
  recent-resolved results.

Metric hrefs use client paths: Open Tickets →
`/tickets?statusGroup=open`; Waiting for Requester →
`/tickets?status=WAITING_FOR_REQUESTER`; Recently Resolved →
`/tickets?statusGroup=resolved&resolvedAfter={windowStart}&sortBy=resolvedAt&direction=desc`.
The client constructs the Recently Updated list link with
`/tickets?updatedAfter={windowStart}&sortBy=updatedAt&direction=desc`. Each
Ticket row `href` opens its Requester Ticket Detail. Encode timestamps as query
parameters. The client does not receive a requesterId query value.

### GET /api/staff/dashboard

IT Staff/Admin only. Return StaffDashboard:

- unassignedOpen: open-status Tickets with ownerId null.
- ownedByMeOpen: open-status Tickets where ownerId is the authenticated user.
- byStatus: counts across all eight current Ticket statuses.
- byITPriority: counts among open-status Tickets for LOW, MEDIUM, HIGH, URGENT.
- recentlyUpdated: up to 10 open Tickets changed during the window, updatedAt
  descending then id descending.
- urgentTickets: up to 5 open HIGH/URGENT Tickets, URGENT before HIGH, then
  oldest updatedAt first, then id.
- Empty arrays and zero counts are explicit. Administrators receive the same
  metrics and scope as IT Staff.

Metric hrefs use client paths: Unassigned Open →
`/staff/tickets?statusGroup=open&ownership=unassigned`; My Open →
`/staff/tickets?statusGroup=open&ownership=mine`; each status count →
`/staff/tickets?status={status}`; each IT Priority count →
`/staff/tickets?statusGroup=open&itPriority={priority}`. The client constructs
the Recently Updated list link with
`/staff/tickets?statusGroup=open&updatedAfter={windowStart}&sortBy=updatedAt&direction=desc`
and Urgent Work with
`/staff/tickets?statusGroup=open&itPriorityGroup=high_or_urgent&sortBy=urgentWork`.
Each Ticket row `href` opens staff Ticket Detail. Encode timestamps as query
parameters. Each filter must yield the same population/order as its metric or
list.

## 7. Contract Validation Checklist

Before implementation, peer review must confirm each exact request/response
shape, role matrix, Action/Ticket transition and completion rule, date/timezone
boundary, drill-down filter, error code, retry/concurrency behavior, and
legacy-data rule. Any accepted change is updated consistently in
specification.md, ui-spec.md, tests.md, and this file before dependent code
begins.
