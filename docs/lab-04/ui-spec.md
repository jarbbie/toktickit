# Lab 4 UI Specification

**Status:** Draft for Issue #67. Proposed details need peer review. This extends
the Zen Green shell in Labs 2–3; existing Login, Requester, staff, and
Administrator screens remain.

## 1. Navigation and Role Home

Add Dashboard navigation with active-page indication. The role home after login
is /dashboard for all roles; the authenticated role selects which dashboard API
and view to render.

| Role | Navigation |
|---|---|
| Requester | Dashboard, My Tickets, Create Ticket |
| IT Staff | Dashboard, Ticket Queue |
| Administrator | Dashboard, Ticket Queue, User Management |

Keep existing direct routes and session/password-change guards. A forbidden
direct route renders no stale dashboard or Ticket data.

## 2. Requester Dashboard

Use one page headed “Dashboard”. Show three labeled metric cards:

- Open Tickets → My Tickets with `statusGroup=open` (NEW, OPEN, IN_PROGRESS,
  WAITING_FOR_REQUESTER, REOPENED).
- Waiting for Requester → My Tickets filtered to WAITING_FOR_REQUESTER.
- Recently Resolved → My Tickets with `statusGroup=resolved`,
  `resolvedAfter=windowStart`, sorted by latest resolution time.

Below the cards show “Recently Updated” (up to five owned Ticket rows/cards) and
“Recently Resolved” (up to five owned resolved/closed Tickets). Each item opens
the Requester Ticket Detail route. Show number, summary, status, IT Priority,
and last-updated/resolution time. Do not duplicate all My Tickets filters or
pagination.

Only the authenticated Requester’s API result may render. Empty lists show a
clear role-appropriate message and a Create Ticket/My Tickets action. A zero
count is shown as 0, not blank.

Dashboard links open My Tickets with matching status-group/date filters in the
URL. My Tickets parses those filters, displays an active filter label, and
offers a clear action; it never accepts a requester ID from the URL. Open and
resolved groups are distinct from a single-status filter. Recently Updated
uses `updatedAfter`; Recently Resolved uses `resolvedAfter` and resolution-time
ordering.

## 3. IT Staff / Administrator Dashboard

Show “Unassigned Open Tickets”, “My Open Tickets”, status distribution for all
eight statuses, and IT Priority counts for open-status Tickets. Show a concise
recently updated list (up to 10) and an “Urgent Work” list (up to five HIGH or
URGENT). Show “My Actions Taken” with the authenticated user's all-time count
and up to five latest Actions they performed, ordered by Action Date/Time
descending then Action ID descending. The performer, not the Action assignee,
determines this scope. Each Action row shows Ticket number, summary, Action
description, status, and Action Date/Time and opens its parent Ticket Detail.
An Administrator sees the same operational dashboard with their own Action
scope.

Every count/card/list has an accessible link to the Ticket Queue with exact
filters: ownership=unassigned, ownership=mine, status, IT Priority, status
group, update window, or the HIGH/URGENT group. Each row
opens staff Ticket Detail. Show Ticket number, summary, Requester, status,
IT Priority, Ticket Owner/Unassigned, and updated time. Use priority then age
ordering for Urgent Work as defined in api-spec.md. The Requester label uses
the API's `{id, name}` summary; do not display or return Requester email or
other account fields in dashboard rows.

Dashboard links open the Queue with matching query filters. The Queue parses
`statusGroup=open`, `updatedAfter=windowStart`,
`itPriorityGroup=high_or_urgent`, and matching sort values, shows
their active filter labels, and offers a clear action. The explicit Status and
IT Priority filters cannot silently override a status/priority group. The
Urgent Work link uses the dedicated urgent-work sort.

Zero counts remain visible. Empty “Recently Updated” and “Urgent Work” lists
have separate helpful messages and link to the Ticket Queue; an empty “My
Actions Taken” list says that the user has not recorded any Actions yet. Do not
fabricate example rows.

## 4. Ticket Detail: Actions Taken

Place a clearly titled Actions Taken section after the Ticket summary and
before status history. Requesters see the section on their own Ticket Detail;
Staff/Admin see it on staff Ticket Detail.

### Action list

Each Action displays date/time, description, result, status badge, assignee or
“Unassigned”, “Performed by” name, follow-up state/note, and Attachment Notes.
Order oldest-to-newest by Action Date/Time then ID; expose status in text, not
color alone. Long text wraps. Requester payload/screen contains no Action event
snapshots or Internal Notes.

For support users, each Action includes a read-only “Action history” disclosure
populated from that record's `events` array in the Action list response. Show
events oldest-to-newest with date/time, actor name/role, event type, and the
changed fields from the allowlisted before/after snapshots; a CREATED event
shows the initial values. Refresh the Action list after a successful write so
the audit history comes from the server. The disclosure has no edit/delete
controls. Requesters receive no `events` property and never see this history.

### Support create/edit/assignment modes

- Create form fields: Action Date/Time, Action Description, Assignee, Follow-Up
  Required checkbox, conditional Follow-up Note, Attachment Notes. Result is
  added before completion or through Edit. Status starts PLANNED; performer is
  a read-only authenticated-user label.
- Assignee choices contain active IT Staff and Administrators only. Include
  Unassigned where allowed. On inactive-assignee conflict, keep the form open,
  refresh choices, and explain that the assignee is unavailable.
- Edit mode changes permitted fields and shows current version/conflict
  feedback. There is no delete action. Terminal status cannot be changed;
  correction edits create an auditable revision.
- Create, edit, assignment, and status controls are available only while the
  parent Ticket is NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, or REOPENED.
  On RESOLVED/CLOSED Tickets, explain that the Ticket must be reopened first;
  on CANCELLED Tickets, explain that its terminal state prevents further Action
  changes. The Actions list and support audit history remain readable.
- Status controls only offer matrix-permitted actions: Start, Complete, Cancel.
  Complete requires a non-empty Result. Complete and Cancel open a named
  confirmation dialog; Cancel is always reversible before confirmation.
- Disable duplicate submission while saving. Reuse the same idempotency key
  after a recoverable create failure; clear form/key only after success.
- On stale conflict, preserve input, refresh current Action/Ticket version, and
  let the user review before resubmitting. Never silently replay changed data.
- Requesters see the read-only Action list and an explanatory empty state; no
  forms, assignment/status controls, or hidden writable inputs.

### Follow-up and attachment notes

Show Follow-up Note only when Follow-Up Required is checked and mark it
required. Clearing the checkbox clears the current note after confirmation if
text would be lost; prior revision remains in support audit history.
Attachment Notes explain the existing file to look for. They are plain text and
do not have file input, upload, or storage controls.

## 5. Ticket Workflow and History

On staff Ticket Detail, show only matrix-permitted next statuses, plus current
status. Resolved/Closed/Cancelled changes require a dialog with Ticket number,
current status, target status, and Confirm/Cancel. The backend can still reject
a permitted-looking transition because of resolution/cancellation gates.

For a failed resolution gate, retain current status, keep actions visible, and
show how many Actions remain active/follow-up-required; focus the message and
link to the Actions section. A stale Ticket workflow conflict refreshes Ticket
and history while preserving the selected form value for review.

Show an ordered Ticket Status History section on Requester and staff detail.
Display from → to, timestamp, and actor; use staff name/role as permitted by
API. Requesters see history for their own Ticket only. History is read-only,
chronological, and has no edit/delete controls. Empty state explains that
history begins with Lab 4 transitions; do not invent legacy events.

Requester “Problem appears resolved?” stays separate from formal status and
history. Its timestamp remains advisory and cannot be used as a formal workflow
transition.

## 6. Shared Loading, Error, and Focus Behavior

For dashboards, Actions, and history:

- Initial request: visible “Loading …” status; do not display stale results.
- Empty data: explicit empty state, separate from request failure.
- Validation: inline adjacent field messages, aria-invalid/aria-describedby,
  focus first invalid field (or linked error summary).
- Success: short role=status announcement and updated returned data.
- Forbidden/not found: safe message; no stale protected data.
- Conflict: preserve draft, announce conflict, provide safe refresh/review path.
- API failure: generic retryable message; preserve form input and idempotency
  key where applicable.
- Busy state: disable duplicate action, use action text such as “Saving…”;
  never use spinner-only feedback.

On route change move keyboard focus to the page heading. Native links/buttons
support keyboard use; all controls have visible labels/focus. Dialogs have
accessible name/description, move and trap focus, support Escape before
submission, and restore focus to the trigger.

## 7. Zen Green, Responsive, and Accessibility Rules

Continue the Lab 2/3 design tokens, cards, forms, badges, buttons, errors,
loading states, and spacing. Label state with text and color. Keep public and
internal content visually distinct; never combine Internal Notes into Requester
responses.

| Viewport | Layout |
|---|---|
| Desktop ≥992px | Metric cards in one row where readable; recent/urgent lists may use two columns; Ticket forms use existing centered detail width. |
| Tablet 768–991px | Cards wrap to two columns; recent lists stack when needed; Action fields use two columns with full-width text fields. |
| Mobile <768px | Cards and lists stack; Action form is one column; long text wraps; confirmation controls remain visible and touch-friendly. |

At 1440×1000, 820×1180, and 390×844, confirm no horizontal page scrolling,
clipping, overlapping controls, inaccessible dialogs, hidden validation, or
color-only statuses. Also inspect 767/768 and 991/992 breakpoint edges.
Capture readable screens under artifacts/lab-04/screenshots/staff-dashboard,
requester-dashboard, actions-taken, and ticket-workflow.
