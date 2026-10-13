# Lab 4 Engineering Specification

**Status:** Draft contract for Issue #67. Design choices marked **Proposed** are
for peer review and are not instructor-mandated until accepted. No Lab 4 product
implementation or test pass is claimed by this document.

## 1. Sprint Goal

Let IT Staff and Administrators plan, assign, record, and finish work under a
Ticket; let Requesters follow that work; enforce a documented Ticket workflow;
and give each role a concise operational dashboard. Preserve the authenticated
TokTickIT product from Labs 1–3 and finish with traceable regression and
demonstration evidence.

## 2. Stakeholder Request Interpretation

The service desk needs a work log that can be assigned to staff and moved
through a small lifecycle. The Ticket Owner still coordinates the Ticket, but
other eligible staff can be assigned or can record work. Requesters can read
Actions on their own Tickets but cannot create or edit them. Requester feedback
that a problem appears resolved is advisory; support staff make formal status
changes. Role-specific dashboards summarize the existing work and link to its
detail.

## 3. Scope

### Included

- Multiple Actions Taken per Ticket, each with date/time, description, result,
  auto-populated performer, assignee, status, conditional follow-up note, and
  descriptive Attachment Notes.
- Action assignment, editing, lifecycle transitions, completion, cancellation,
  inactive-assignee rejection, role enforcement, stale-update protection, and
  retry-safe creation.
- An append-only, stable Ticket status history and a server-enforced Ticket
  resolution rule.
- Requester and IT Staff dashboards; Administrators use the Staff dashboard.
- Additive PostgreSQL/Prisma migration, preserved Lab 1–3 data and files,
  realistic idempotent seed data, tests, responsive/accessibility polish,
  reviewed staging integration, and the nine-part submission PDF.

### Explicitly excluded

Automatic SLA clocks/escalation/on-call/breach notices; email, SMS, LINE, push,
or other external notifications; inventory, spare parts, purchasing, service
costs, time-sheet billing, payroll; multi-level approval or e-signature; BI,
custom report builders, data-export warehouses; multi-tenancy or
production-scale cloud operations; and any feature not approved in this
contract. Attachment Notes describe files; they do not add Action file upload.

## 4. Functional Requirements

| ID | Requirement |
|---|---|
| FR-01 | A Ticket can have zero or more Actions Taken. Support users can list, create, assign, edit, transition, complete, and cancel permitted Actions. |
| FR-02 | Every Action contains Action Date/Time, Description, Result, Performed by (auto), Follow-Up Required?, conditional Follow-up Note, Attachment Notes, assignee, and status. |
| FR-03 | IT Staff and Administrators can write Actions on accessible Tickets. A Requester can read Actions only on their own Ticket and cannot write them. The backend enforces all permissions. |
| FR-04 | The backend supplies the performer from the authenticated account. Ticket Owner, Action assignee, and performer are separate values. |
| FR-05 | The application enforces the Action status matrix, active-assignee rules, terminal behavior, validation, and stale-write conflicts. |
| FR-06 | The application enforces the Ticket status matrix and resolution gate on every API request and records each successful Ticket status change in append-only history. |
| FR-07 | Requester resolution indication remains advisory and does not directly change Ticket status. |
| FR-08 | Requester dashboard summarizes only the current Requester’s Tickets, attention state, recent activity, and recently resolved work. |
| FR-09 | IT Staff/Admin dashboard gives concise operational counts and recent or urgent Ticket links. Metrics are calculated by the backend from authoritative records. |
| FR-10 | Dashboard results define their calculation windows, sorting, limits, empty behavior, and drill-down destinations; they do not return entire Ticket collections. |
| FR-11 | Database changes are additive and preserve existing User, Ticket, Attachment/file, Public Comment, Internal Note, and reference data. Seed runs repeatedly without duplicating or overwriting user work. |
| FR-12 | Existing authenticated role behavior, ownership, comments, notes, attachments, account management, and Zen Green conventions continue to work. |
| FR-13 | Final product handles loading, validation, success, empty/no-results, forbidden, conflict, not-found, and safe API failure; prevents duplicate writes and retains drafts after recoverable failure. |
| FR-14 | Required unit, API/integration, UI/style, responsive/accessibility, authorization, workflow, migration/regression, performance-smoke, and E2E evidence is traced to ACs and the exact verified commit. |

## 5. Business Rules

Rules below are proposals for contract review unless explicitly identified as
inherited or required by the handout.

| ID | Rule |
|---|---|
| BR-01 | **Required:** each Action belongs to exactly one Ticket. A Ticket may have zero or many Actions. |
| BR-02 | **Required:** Ticket Owner coordinates the Ticket. An Action may be assigned to or performed by a different support user. |
| BR-03 | **Proposed:** one Action has zero or one assignee. Assignee must be an active IT Staff or Administrator. Requester, inactive, missing, or other-role assignees are rejected with a safe conflict. Unassignment is allowed while an Action is not cancelled. |
| BR-04 | **Proposed:** Performed by is set from the authenticated support user who creates the Action and is read-only. Assignee is a separate editable field. Every later edit/assignment/status transition records its authenticated actor in append-only Action event history. |
| BR-05 | **Inherited:** any authenticated IT Staff or Administrator may operate any Ticket; being its owner or an Action's assignee is not an authorization boundary. Requesters read only their own Ticket data. |
| BR-06 | Action Description is trimmed and 1–2,000 characters. Result is trimmed and at most 2,000 characters; it is required at completion. Attachment Notes are plain text, optional, at most 1,000 characters, and never interpreted as a path or uploaded file. |
| BR-07 | Action Date/Time is a required valid ISO 8601 timestamp. The UI collects local date/time in Asia/Bangkok and submits an explicit offset; the API stores and returns UTC. No implicit browser/server timezone conversion is accepted. |
| BR-08 | Follow-Up Required is Boolean. If true, Follow-up Note is trimmed and required at 1–1,000 characters. If false, the current note is cleared; previous snapshots remain in the Action event history. |
| BR-09 | **Proposed Action statuses:** PLANNED, IN_PROGRESS, COMPLETED, CANCELLED. PLANNED may move to IN_PROGRESS, COMPLETED, or CANCELLED; IN_PROGRESS may move to COMPLETED or CANCELLED; COMPLETED and CANCELLED are terminal. Repeating the current status or making any other transition returns 409. |
| BR-10 | **Proposed:** an Action can be edited with version checking. Content/follow-up corrections remain possible after completion, but status cannot leave a terminal state. Every create/edit/assignment/status change appends an event with actor/time and a before/after snapshot. Actions cannot be hard-deleted. |
| BR-11 | Action list order is Action Date/Time ascending, then Action ID ascending. Event histories are event time ascending, then event ID ascending. Ordering is stable when timestamps match. |
| BR-12 | The authenticated Requester can read all current Action fields and approved status history only for their own Ticket; no Action write or assignee-control operation is permitted. Action Notes and results are requester-visible, so users must not enter secrets or private diagnostic data there. Internal Notes remain staff-only. |
| BR-13 | Attachment Notes are explanatory text only. They do not change the existing Ticket Attachment permission, storage, upload, or removal behavior. |
| BR-14 | **Inherited Ticket statuses:** NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CLOSED, REOPENED, CANCELLED. Only IT Staff/Admin can change formal status. The matrix below refines the Lab 3 matrix; CANCELLED remains terminal. |
| BR-15 | **Proposed resolution gate:** entering RESOLVED requires at least one COMPLETED Action, no PLANNED or IN_PROGRESS Action, and no Action with Follow-Up Required=true. If not met, return 409 without changing the Ticket or writing history. Staff must complete/cancel remaining work and close required follow-up first. |
| BR-16 | A Ticket cannot enter CANCELLED while a PLANNED or IN_PROGRESS Action remains; support must cancel or finish those Actions first. This prevents orphaned work. |
| BR-17 | **Inherited:** a Requester may set the “Problem appears resolved” indication only on an owned Ticket in NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, or REOPENED. It sets an advisory timestamp only, preserves the first timestamp, and never changes formal status. Reopening clears the indication. |
| BR-18 | Every successful Ticket status change stores `{ticketId, actorId, fromStatus, toStatus, changedAt}` in append-only TicketStatusEvent history in the same transaction as the Ticket update. No event is edited/deleted; reads are chronological with a stable ID tie-breaker. |
| BR-19 | Ticket status transitions are checked against the persisted current status inside a transaction. Same-status, illegal, and stale-version attempts return 409 and leave Ticket/history unchanged. Every transition requires an expected workflow version. |
| BR-20 | Ticket and Action writes affecting resolution are serialized by Ticket. Each such write increments Ticket.workflowVersion; Action edits also increment Action.version. Missing/stale versions return a safe 409. A failed transaction changes neither records nor event history. |
| BR-21 | Action create accepts a globally unique client-generated UUID idempotency key. An exact replay by the same actor with the same payload returns the existing Action; reuse with a different actor/payload returns 409. The client disables duplicate submission and retains the key/draft after a recoverable failure. |
| BR-22 | Ticket status history is readable by the owning Requester and all support users for accessible Tickets. It contains status, actor display name/role, and time only; it never includes Internal Notes or hidden account fields. |
| BR-23 | **Proposed dashboard open-status set:** NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, REOPENED. RESOLVED, CLOSED, and CANCELLED are not open. |
| BR-24 | **Proposed dashboard time window:** “last 7 days” means from 00:00 Asia/Bangkok six calendar days before today through the request time. The response includes `asOf` and `windowStart` as ISO UTC. Empty lists are `[]`; zero counts are `0`. |
| BR-25 | Requester dashboard queries are constrained by authenticated requesterId in every query, not only in client filters. Recently resolved means currently RESOLVED/CLOSED with the latest recorded transition into RESOLVED inside the window. Legacy Tickets without Lab 4 transition events are not given invented resolution dates and are omitted from this recent list. Add compatible list filters for status groups and time windows so dashboard links reproduce each population. |
| BR-26 | Staff/Admin dashboard counts use the documented active-status set for workload/priority metrics. Add compatible queue filters for the open-status group, updated-since window, and HIGH/URGENT group so dashboard links reproduce the displayed population. Admin reuses Staff metrics; no separate account-count dashboard is added. |
| BR-27 | All timestamps are server-controlled or validated ISO timestamps and serialize in UTC. A real Action, Ticket status/owner/priority, comment/note, or Attachment mutation updates Ticket.updatedAt transactionally; reads and exact idempotent replays do not. |
| BR-28 | General errors use safe JSON `{error, code?, fieldErrors?}`. Use 401 unauthenticated, 403 role/origin/password gate, 404 missing or concealed Requester-owned Ticket, 400 malformed/invalid input, 409 stale/illegal/ineligible/idempotency conflicts, and safe 500. Never expose SQL, stack traces, hashes, session tokens, storage paths, or internal Action snapshots. |
| BR-29 | Migration is additive. Existing Tickets receive workflowVersion=1 and no fabricated Action or status events. Legacy status remains intact; current history begins when Lab 4 transitions occur. Preserve IDs, foreign keys, status, owner, priorities, timestamps, and all existing attachment metadata/files. |
| BR-30 | Migration recovery starts with a verified database/files backup. Test populated migration and restore/forward-repair on a disposable copy; never use destructive reset as preservation evidence. Production-style recovery is restore backup before cutover or add a corrective forward migration after cutover. |
| BR-31 | Seeds use stable unique keys/upserts and are safe to rerun. They cover every major Ticket status and priority, assigned/unassigned Tickets, zero/one/multiple Actions, Action lifecycle states, and both non-zero/zero dashboard cases without overwriting user-modified fixtures. |
| BR-32 | UI hides unavailable actions for guidance, but backend authorization and state rules remain authoritative for every write. |
| BR-33 | Lab 4 preserves Labs 1–3 authentication, requester ownership, queue/detail, comments, internal-note isolation, attachments, and Administrator management. No protected data survives logout/user switch in client state. |
| BR-34 | All screens continue the Zen Green language, semantic labels, visible keyboard focus, text status cues not dependent on color, and layouts usable without clipping/overlap/page overflow. |

### Authorization Matrix

All protected operations require an active session and completed initial-password
change. “Own” means Ticket.requesterId equals the authenticated user. Support
includes both IT Staff and Administrators.

| Operation | Guest | Password-change session | Requester | IT Staff | Administrator |
|---|---|---|---|---|---|
| Health/login | Allowed | Allowed | Allowed | Allowed | Allowed |
| Current user/logout/change password | As Lab 3 | Allowed | Allowed | Allowed | Allowed |
| Existing Requester Ticket APIs | 401 | 403 | Own Tickets | 403 | 403 |
| Existing staff queue/detail/operations | 401 | 403 | 403 | All Tickets | All Tickets |
| Read Actions | 401 | 403 | Own Tickets | All Tickets | All Tickets |
| Create/edit/assign/transition/complete/cancel Actions | 401 | 403 | 403 | All Tickets | All Tickets |
| Read Ticket status history | 401 | 403 | Own Tickets | All Tickets | All Tickets |
| Change formal Ticket status | 401 | 403 | 403 | All Tickets | All Tickets |
| Requester resolution indication | 401 | 403 | Own Ticket, permitted statuses | 403 | 403 |
| Requester dashboard | 401 | 403 | Own data only | 403 | 403 |
| Staff dashboard | 401 | 403 | 403 | All operational data | Same as Staff |
| Internal Notes | 401 | 403 | 403, no lookup/content | All Tickets | All Tickets |

Role checks happen before restricted resource lookup. Requesters receive the
same 404 for missing and foreign-owned Ticket resources. No Action write may
trust client-supplied actor, performer, Ticket owner, or role.

### Ticket Status and Confirmation Matrix

This retains the Lab 3 transitions. Only IT Staff/Admin may perform them.

| Current | Permitted next statuses | UI confirmation |
|---|---|---|
| NEW | OPEN, IN_PROGRESS, CANCELLED | CANCELLED |
| OPEN | IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CANCELLED | RESOLVED, CANCELLED |
| IN_PROGRESS | WAITING_FOR_REQUESTER, RESOLVED, CANCELLED | RESOLVED, CANCELLED |
| WAITING_FOR_REQUESTER | IN_PROGRESS, RESOLVED, CANCELLED | RESOLVED, CANCELLED |
| RESOLVED | CLOSED, REOPENED | CLOSED |
| CLOSED | REOPENED | None |
| REOPENED | IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CANCELLED | RESOLVED, CANCELLED |
| CANCELLED | None (terminal) | None |

An otherwise permitted transition to RESOLVED or CANCELLED also must pass
BR-15/BR-16. The UI confirmation is not authorization.

### Action Status and Confirmation Matrix

| Current | Permitted next statuses | Notes |
|---|---|---|
| PLANNED | IN_PROGRESS, COMPLETED, CANCELLED | Direct completion is permitted for a short action. |
| IN_PROGRESS | COMPLETED, CANCELLED | Completion requires Result. |
| COMPLETED | None | Terminal; auditable text/follow-up corrections use a new revision. |
| CANCELLED | None | Terminal; reason is optional unless peer review approves otherwise. |

Assign/reassign/unassign require a current Action version. Replacing an existing
assignee asks for UI confirmation. Completing/cancelling asks for confirmation;
the API still enforces lifecycle and permissions.

### Dashboard Calculations

| Dashboard item | Exact proposed calculation | Drill-down |
|---|---|---|
| Requester: Open Tickets | Own Tickets in BR-23 open-status set | My Tickets with `statusGroup=open` |
| Requester: Waiting for Me | Own Tickets in WAITING_FOR_REQUESTER | My Tickets filtered to that status |
| Requester: Recently Updated | Up to 5 own Tickets updated in BR-24 window, updatedAt desc then id desc | My Tickets with `updatedAfter=windowStart`, sorted updatedAt desc then id desc |
| Requester: Recently Resolved | Count and up to 5 own Tickets currently RESOLVED/CLOSED whose latest transition to RESOLVED is in the window; resolution-event time desc then id desc | My Tickets with `statusGroup=resolved&resolvedAfter=windowStart` |
| Staff: Unassigned | Open-status Tickets with ownerId null | Queue with `statusGroup=open&ownership=unassigned` |
| Staff: Mine | Open-status Tickets with ownerId=current user | Queue with `statusGroup=open&ownership=mine` |
| Staff: By Status | Counts for all eight current statuses | Queue, selected status |
| Staff: By IT Priority | Open-status Tickets grouped by LOW/MEDIUM/HIGH/URGENT | Queue with `statusGroup=open` and the selected `itPriority` |
| Staff: Recently Updated | Up to 10 open-status Tickets in the window, updatedAt desc then id desc | Queue with `statusGroup=open&updatedAfter=windowStart`, sorted updatedAt desc then id desc |
| Staff: Urgent Work | Up to 5 open-status HIGH/URGENT Tickets, URGENT first, then oldest updatedAt, then id | Queue with `statusGroup=open&itPriorityGroup=high_or_urgent`, sorted by urgent priority then oldest update |

Administrators receive the Staff dashboard. All counts and lists are computed
server-side; every card with a destination has a matching queue filter.

## 6. UI Specification Summary

The authenticated shell adds Dashboard navigation for each role with an active
state. Requesters receive dashboard, My Tickets, Create Ticket, and Ticket
Detail; staff receive dashboard, Queue, and Ticket Detail; Administrators also
retain User Management. Ticket Detail gains an Actions section and ordered
status-history section. The full screen/state contract is in [ui-spec.md](ui-spec.md).

Use the existing Zen Green components and responsive breakpoints: desktop
≥992px, tablet 768–991px, mobile <768px. At each viewport, preserve labels,
visible focus, keyboard operation, text status cues, usable dialogs, and no
horizontal page overflow.

## 7. Data Changes

PostgreSQL and Prisma remain. The proposed additive schema is:

| Model | Fields / purpose |
|---|---|
| Ticket additions | workflowVersion Int default 1; relation to Actions and append-only TicketStatusEvents |
| ActionTaken | id, ticketId, actionAt, description, result?, performedById, assigneeId?, status, followUpRequired, followUpNote?, attachmentNotes?, version, globally unique idempotencyKey, creationFingerprint, createdAt, updatedAt |
| ActionEvent | id, actionId, actorId, eventType, prior/next snapshot, createdAt; append-only audit of create/edit/assign/status changes |
| TicketStatusEvent | id, ticketId, actorId, fromStatus, toStatus, changedAt; append-only formal Ticket transition history |

ActionStatus enum values are PLANNED, IN_PROGRESS, COMPLETED, CANCELLED. New
foreign keys use restrictive deletion; no product hard-delete API is added.
Add a global unique constraint on Action.idempotencyKey and indexes on
Action(ticketId, actionAt, id), Action(assigneeId, status),
Action(ticketId, status), ActionEvent(actionId, createdAt, id), and
TicketStatusEvent(ticketId, changedAt, id) plus status/window query indexes.

**Database decision D-01 (proposed):** retain an explicit TicketStatusEvent
table instead of deriving history from Ticket.updatedAt. It preserves the
ordered actor/from/to facts needed for audit and accurate recent-resolution
queries. **D-02 (proposed):** use Ticket.workflowVersion plus Action.version
and a Ticket-scoped transaction to prevent status/Action races and stale
overwrites. **D-03 (proposed):** store ActionEvent snapshots so editable
Actions remain auditable. Review these choices before implementation.

Migration adds tables/columns/indexes without recreating existing tables or
changing IDs. Existing Tickets start at workflowVersion=1, have no generated
Actions, and have no fabricated TicketStatusEvent rows. Their current status,
owner, priority, timestamps, attachments, and files remain. Historical Tickets
remain usable; a legacy Resolved/Closed Ticket has no “recent resolution” date
until it is resolved again through the recorded workflow.

Seed is create-only/idempotent. It covers zero/one/multiple Actions, all Action
statuses, all Ticket statuses and priorities, assigned/unassigned Tickets, and
dashboard zero/non-zero cases. Test a populated migration and recovery on an
isolated PostgreSQL copy with a verified database/files backup; never use
`prisma migrate reset` against the populated baseline.

## 8. API Contract Summary

The API extends base path `/api`; existing Labs 1–3 APIs remain unchanged
except documented additive Ticket response fields/version behavior. New routes:

| Method and path | Purpose |
|---|---|
| GET `/api/tickets` | Existing Requester list, add compatible status-group and date-window filters for dashboard drill-downs |
| GET `/api/staff/tickets` | Existing support queue, add compatible status-group and date-window filters for dashboard drill-downs |
| GET `/api/tickets/:ticketId/actions` | Read all Actions on own Ticket for Requester; all Tickets for support |
| POST `/api/staff/tickets/:ticketId/actions` | Create an Action |
| PATCH `/api/staff/actions/:actionId` | Edit Action fields with expected version |
| PATCH `/api/staff/actions/:actionId/assignee` | Assign, reassign, or unassign |
| PATCH `/api/staff/actions/:actionId/status` | Start, complete, or cancel |
| GET `/api/tickets/:ticketId/status-events` | Read authorized ordered status history |
| PATCH `/api/staff/tickets/:ticketId/status` | Existing route, extended with expected workflow version, resolution gate, event insert |
| GET `/api/requester/dashboard` | Authenticated Requester metrics/list |
| GET `/api/staff/dashboard` | IT Staff/Admin metrics/list |

Exact bodies, response shapes, validation, errors, and concurrency are in
[api-spec.md](api-spec.md). Existing list endpoints gain additive `statusGroup`,
`updatedAfter`, `resolvedAfter`, and staff-only `itPriorityGroup` filters so
dashboard drill-downs return the same populations as their counts/lists. Read
payloads never contain credential/session fields, storage keys, internal notes,
or raw database details.

## 9. Acceptance Criteria

| ID | Observable criterion |
|---|---|
| AC-01 | A Ticket stores zero or more Actions; each displayed Action has all required fields and stable ordering. |
| AC-02 | Support user can create an Action; backend sets Performed by from the authenticated session, not the request body. |
| AC-03 | Support user can assign/reassign/unassign an Action to eligible active support; an inactive or wrong-role target is rejected. |
| AC-04 | Support user can edit valid Action fields; invalid fields are rejected; stale Action versions return conflict without data loss. |
| AC-05 | Action transitions follow the matrix; completion requires a Result; cancellation is terminal; repeat/double-submit is safely handled. |
| AC-06 | Conditional follow-up note and attachment notes validate; attachment notes do not create or upload files. |
| AC-07 | Requester can read Actions only on own Ticket and cannot create/edit/assign/transition them through direct API calls. |
| AC-08 | Requester sees accurate, scoped dashboard metrics and recent lists with working drill-downs. |
| AC-09 | IT Staff/Admin sees accurate backend-calculated counts and recent/urgent lists with matching queue filters. |
| AC-10 | Every Ticket status pair/role follows the matrix; legal changes create one append-only event, illegal/stale changes create none. |
| AC-11 | Requester resolution indication remains advisory; the backend resolution gate blocks incomplete Actions and pending follow-up. |
| AC-12 | Requester and support users see only authorized, chronologically stable Ticket status history; Internal Notes never appear to Requesters. |
| AC-13 | Populated migration preserves Labs 1–3 identities, relationships, timestamps, and attachment files; no historical Action/status event is fabricated. |
| AC-14 | Seed covers required statuses, priorities, assignment states, Action counts/states, and dashboard zero/non-zero cases; rerun is safe. |
| AC-15 | Major Lab 4 screens provide documented loading, empty, validation, forbidden, conflict, success, and safe-failure behavior. |
| AC-16 | Role navigation and direct APIs prevent unauthorized reads/writes; stale and concurrent mutations cannot silently overwrite workflow state. |
| AC-17 | Desktop/tablet/mobile screens are keyboard-usable, labeled, readable, and free of clipping/overlap/horizontal page overflow. |
| AC-18 | All required Labs 1–4 tests/builds pass from final main with truthful evidence, current README, review records, and the nine-part PDF. |

Every AC maps to planned test IDs in [tests.md](tests.md). No criterion is
considered passed until its test/evidence is actually run and recorded.

## 10. Product Definition of Done

- All approved FR/BR/AC rules and both matrices are implemented server-side and
  reflected consistently in API/UI/test docs.
- Additive migration, populated-data preservation, recovery, and idempotent seed
  have reproducible isolated PostgreSQL evidence.
- All Action, dashboard, Ticket workflow, authorization/concurrency, Lab 1–3
  regression, UI/style/accessibility/responsive, performance-smoke, and E2E tests
  pass from final `main`; server/client builds pass.
- Required E2E files exist under `e2e/lab-04/` and Playwright still runs
  the inherited `client/e2e/` regression flows.
- Screenshots under `artifacts/lab-04/screenshots/{staff-dashboard,requester-dashboard,actions-taken,ticket-workflow}/`
  are readable and visually inspected at desktop, tablet, and mobile sizes.
- README setup, migration/recovery, seed, test, and demo steps match the final
  app. Reviewer/AI-use records contain only real identities, prompts, and events.
- GitHub Issues move through the inherited Kanban flow to Done only after
  acceptance; feature PRs merge to `lab4-staging` and release PR to
  `main` after peer approval. Evidence names the exact final-main commit.
- One concise PDF uses the exact headings “Answer Part 1” through “Answer Part
  9” in order with working links and readable screenshots.

## 11. Assumptions and Decisions

| Decision | Source | Proposed resolution | Status |
|---|---|---|---|
| Requester access to Actions | Handout says Requesters see all Actions on own Ticket and cannot write | Read all current Action fields for owned Tickets; no write | Proposed |
| Action lifecycle | Final rubric requires assign, status transition, complete, cancel | PLANNED → IN_PROGRESS → COMPLETED/CANCELLED with direct completion and terminal final states | Proposed |
| Action assignee | Final rubric requires assignment and inactive-assignee rejection | Active IT Staff/Admin only; no effect on Ticket Owner or API role scope | Proposed |
| Performed by | Handout says auto; actor field must not trust client | Authenticated creator, immutable; later actors recorded in ActionEvent | Proposed |
| Ticket status history | Part 7 requires stable ordering, append-only behavior, role visibility | TicketStatusEvent table, ordered by changedAt/id | Proposed |
| Resolution gate | Handout requires a backend resolution rule but does not state formula | Require completed work, no active Actions, and no required follow-up | Proposed; peer approval needed |
| Legacy Tickets | Migration must preserve earlier data | Do not synthesize Actions/events; legacy resolved work lacks Lab 4 resolution time | Proposed |
| Dashboard time window | Must define timezone/date boundary | Seven Asia/Bangkok calendar days through request time | Proposed |
| E2E paths | Handout lists root `e2e/lab-04`; current app uses `client/e2e` | Add root path and configure existing Playwright config to discover both | Proposed |
| Attachment Notes | Text asks what file to look for; no Action upload requirement | Plain text only; do not change attachment lifecycle | Handout-compatible |
| Product expansion | Handout §4.2 explicit exclusions | No excluded service/inventory/payroll/BI/cloud feature | Required |

Change a proposal only through peer-reviewed contract updates before the
dependent implementation issue begins. The student must personalize the final
AI reflection and provide genuine reviewer evidence; neither can be invented.
