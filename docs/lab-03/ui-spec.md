# Lab 3 UI Specification

This extends the [Lab 2 visual contract](../lab-02/ui-spec.md) and current React
shell. Roles and state transitions follow [specification.md](specification.md);
requests and response fields follow [api-spec.md](api-spec.md).

## 1. Zen Green Foundation and Reusable Components

| Token or convention | Required use |
|---|---|
| `#006B3C` | Header and primary actions |
| `#0B7A46` | Links, active controls, hover, and visible keyboard-focus accents |
| `#EAF6EF` | Selected/success/subtle card and table-heading emphasis |
| `#F5F7F6` | Page background |
| White | Card surfaces and editable inputs |
| `#24342D` | Main text |
| `#F0F1F3` | Read-only fields, consistent with existing `.readonly-field` |
| `#8B1E2D` | Invalid fields/messages and confirmed destructive actions |
| Amber | Warning/waiting emphasis; always accompanied by text |
| Type/spacing | Native sans-serif, 15px body, compact labels, heavier headings; 4px spacing rhythm, 8px within close groups, 12–16px card padding, 20–24px between sections, 32–48px page padding |

Reuse/refactor the existing header, cards, form fields, read-only field grid,
buttons, feedback, badges, and Attachment presentation. New workspaces share
these components; do not create separate staff/admin visual systems. Primary
green buttons submit/save/confirm; outlined green or neutral buttons navigate
and cancel. Removal/deactivation starts with red-outline actions and uses dark
red for the confirmed destructive action. Native disabled controls prevent
re-entry while a request is pending; busy text remains visible (“Signing in…”,
“Saving…”, “Posting…”).

Badge values are explicit title-case labels. Both priority types use Low,
Medium, High, Urgent, with the Lab 2 pale green/amber/red treatment and the
adjacent label “Requested Priority” or “IT Priority”. Never rely on color to
distinguish them. Status labels are New, Open, In Progress, Waiting for Requester,
Resolved, Closed, Reopened, Cancelled. Use green for New/Open/Resolved, amber
for Waiting for Requester/Reopened, and readable neutral treatment for the
others. Role badges say Requester, IT Staff, Administrator; activation says
Active or Inactive. No enum underscores are shown to users.

## 2. Routes, Authentication Gate, and Role Navigation

| Route | Screen / mode | Permitted role |
|---|---|---|
| `/login` | Login form | Unauthenticated; an existing session continues through its gate |
| `/change-password` | Mandatory or voluntary Change Password | Any authenticated User |
| `/tickets` | My Tickets / view list | Requester |
| `/tickets/new` | Create Ticket / create and saved result | Requester |
| `/tickets/:ticketId` | Requester Ticket Detail / view with attachment and conversation actions | Owning Requester |
| `/staff/tickets` | Staff Ticket Queue / view list | IT Staff, Administrator |
| `/staff/tickets/:ticketId` | Staff Ticket Detail / view and operational edit | IT Staff, Administrator |
| `/admin/users` | User Management / list, create, edit, reset | Administrator |

At startup and reload, show “Checking your session…” while calling auth/me.
Do not render protected content until identity is known. A 401 redirects to
Login; mustChangePassword directs to Change Password and prevents normal
navigation. A role mismatch shows “Access denied” and a link to the permitted
home, without requesting protected data. Unknown routes show a safe not-found
view and permitted-home link. Remove the `/select` selector route and all
Development Requester/Change Requester controls; discard the obsolete
`toktickit.requesterId` storage key on initialization.

The green header visibly shows TokTickIT, current name, and role without opening
a menu. Requester navigation contains My Tickets and Create Ticket. IT Staff
navigation contains Ticket Queue. Administrator navigation contains Ticket
Queue and User Management. The profile menu shows name/email read-only and
Change Password/Logout; there is no profile-edit screen. Role home is My Tickets
for Requester, Ticket Queue for IT Staff, and User Management for Administrator.

After login/password change use the role home. If a retained return route is
implemented, it must be a permitted internal path, never an external URL.
Logout clears cached protected data after confirmed server success and returns
to Login; a deletion failure shows safe feedback with Retry. A 401 during use
immediately clears protected state and shows the session-ended Login message.
Self-role change or self-reset clears identity and returns to Login. New login
cannot reuse a previous user's ticket data or form state.

## 3. Login and Change Password

### Login

Use a centered compact card with heading, Email, Password, and Sign in. Visible
labels use appropriate autocomplete (`username`, `current-password`). Password
is masked with an optional labelled show/hide control. Validate required email
and password limits; do not trim passwords. Keep the email after failure and
never persist password input outside the current form. Display the same safe
message for invalid, unknown, and inactive accounts: “Unable to sign in. Check
your credentials or contact an administrator.”

While signing in, disable repeat submission and show progress. Show safe API
failure and retry, and throttle feedback informed by Retry-After. Successful
login navigates to mandatory Change Password or the role home. Do not offer
self-registration, forgot-password email, or social login.

### Change Password

Show Current Password, New Password, Confirm New Password, and Save Password.
Display “Use 12–128 characters. Your new password must differ from your current
password. Spaces are part of your password.” Confirmation must match exactly;
it stays client-side. Use current-password/new-password autocomplete, masked
inputs, and per-field errors linked to labels.

Mandatory mode says “Change your initial password to continue” and offers
Logout; normal navigation and cancellation into the app are unavailable.
Voluntary mode offers Cancel to role home. While saving disable re-entry; on
failure preserve the form for correction within the current screen. On success
clear password fields and show a brief success announcement while continuing
to role home using the replacement session. Never display or store the saved
password in a result card.

## 4. Requester Screens and Lab 2 Regression

### Create Ticket

Retain the Lab 2 create/read-only/saved modes. Show authenticated Requester,
Ticket Number, and Ticket Date as read-only. Editable controls remain Category,
Related System, Requested Priority, Summary, Description, and one optional file;
Requested Priority defaults to Medium. Reference loading/failure, adjacent
field/file validation, busy/disabled submission, retained values/file after
failure, and official-number success feedback remain required.

Initial status and IT Priority come from the API. File upload follows Ticket
creation. On upload failure, show the saved Ticket Number, safe warning, and
View Ticket Details action to retry; do not resubmit the ticket.

### My Tickets

Retain search by Ticket Number/Summary, Category/Requested Priority/Status
filters, Clear Filters, sorts, page sizes 5/10/20, numbered pagination, and Create
Ticket. Include all eight status options. Search/filter/sort/page-size changes
reset page to 1; Previous/Next/page-number changes retain the selected page.
Desktop retains Ticket Number, Created Date, Summary, Category, Requested
Priority, Status, and Last Updated; smaller screens use labelled cards.

Show distinct “No tickets yet” and “No tickets match your filters” feedback,
loading, safe failure with Retry, and accessible Ticket Number links. All list
data comes from the session; there is no identity parameter or selector.

### Requester Ticket Detail

Keep submitted fields read-only in the existing grouped card: number/date,
Requester, Category/Related System, Summary/Description, Requested Priority,
IT Priority, Ticket Owner or Unassigned, status, and Last Updated. Show the
Problem Appears Resolved action only in allowed states. After success display
“You indicated this problem appears resolved” with the backend time and explain
that staff still manage formal status. Disable repeat indication when already
recorded. Reopened removes the old indication and allows a new one.

Use separate clearly labelled Public Comments and Attachments sections. Public
Comments show author/time and plain text, an empty message, and a labelled
1–2000 character composer with Post public comment. There is no Internal Notes
section, count, or editable ticket-status/priority/owner control.

Attachments retain filename, type/size, creation time, and active Download/
Remove actions. Upload shows accepted types/5 MiB limit and five-active limit.
Remove opens an inline or dialog confirmation with required reason, Confirm
removal, and Cancel. Removed entries retain reason/time and a Removed badge
without download/preview controls. Upload failures retain selected file; safe
load/not-found/forbidden/conflict feedback does not expose another Requester.

## 5. IT Staff Ticket Queue

Desktop uses a wide centered list with these eight columns:

| Column | Content / purpose |
|---|---|
| Ticket Number | Accessible link to operational Detail |
| Summary / Requester | Summary with Requester name below; supports identifying the report without another full column |
| Category | Triage context |
| Requested Priority | Clearly labelled submitted priority badge |
| IT Priority | Clearly labelled operational priority badge |
| Current Status | Human-readable status badge |
| Ticket Owner | Name or Unassigned |
| Last Updated | Latest activity timestamp |

Created Date remains available in Detail and as a sort option. This set supports
triage and responsibility while keeping the table readable. There are no bulk
actions or additional dashboard panels; total matching tickets is a simple count.

Search label: “Search tickets”; hint: “Ticket number, summary, or Requester”.
Filters: Category, Requested Priority, IT Priority, Current Status, Ownership
(All, Mine, Assigned, Unassigned). Clear Filters restores defaults. Sort controls
expose Last Updated, Created Date, Ticket Number, Requested Priority, IT Priority,
and Current Status, plus ascending/descending. Supported desktop headers may
also sort with an announced direction. Default is Last Updated descending.
Page sizes are 10/20/50 with Previous/Next, bounded page links, and match count.
Search/filter/sort/page-size changes reset page; page navigation does not.

Loading uses a visible status; distinguish an empty system from no filter
matches, provide clear-filter action, and show safe retryable failures.
Forbidden state has no stale rows. Opening detail and returning to the queue
retains query/page state for the current session. Out-of-range empty pages
offer Previous or First page using the returned totals.

At tablet/mobile sizes, render a card per ticket with an accessible number link,
summary/Requester, Category, both labelled priorities, status, owner, and update
time. Filters wrap into two columns on tablet and one on mobile; sorting and
pagination remain available. Do not squeeze eight columns into a phone grid.

## 6. IT Staff Ticket Detail

Use the Requester Detail's read-only submitted-information card, with Back to
Ticket Queue preserving query state. Present an Operations card with:

- Current Ticket Owner or Unassigned, Claim Ticket for unassigned tickets,
  and an owner select from StaffTicketDetail.ownerOptions with Unassigned.
  First assignment saves directly; replacing/removing an existing owner opens
  confirmation naming old and new ownership. Any staff member can operate any
  ticket; do not disable controls because another staff member owns it.
- A labelled IT Priority select and Save IT Priority; Requested Priority stays
  read-only. Unchanged values need no request.
- Current Status badge, next-status select containing only matrix-permitted
  targets, and Update Status. Selecting Resolved, Closed, or Cancelled requires
  a dialog naming the ticket and transition, Confirm, and Cancel. Cancelled
  shows no outgoing status action. Status changes do not require ownership.
- A visible Requester resolution indication and backend time when present,
  clearly separate from Current Status.

Public Comments and Internal Notes are separate labelled sections and composers,
never one ambiguous toggle. Public composer says “Visible to the Requester and
support team”, with Post public comment. Notes say “Internal — visible only to
IT Staff and Administrators”, use a subtle neutral panel, and Save internal
note. Limits are 2000/4000; trim validation rejects empty text. Lists show
author/time in chronological order and plain text with preserved line breaks.
Never render submitted HTML or provide edit/delete controls.

The Attachments section shows active downloads and removed metadata. Staff
have no Upload or Remove control. Each panel has local loading/empty/failure
feedback and retains typed content after a failed save. Clear a composer after
successful creation and announce success. Operations show busy state; a claim
conflict says the ticket was assigned and reloads current ownership; invalid
transition/owner conflicts refresh current operations without claiming success.

## 7. Administrator User Management

One screen at `/admin/users`, with list and explicit create/edit/reset modes in
a shared form panel or accessible dialog. No separate profile/audit dashboard.

- List: Name, Email, Role, Status, Edit; search name/email; optional single Role
  filter; Clear search/filter; Create User. Show active and inactive accounts.
  No list pagination, bulk selection, multiple-role control, or delete action.
- Create: labelled Name, Email, Role (one required select), Active checkbox,
  Initial Password and client-only Confirm Initial Password. Active defaults
  checked; role starts unselected. Explain next-login change and local direct
  communication of the initial password. Create User and Cancel; mask passwords.
- Edit: Name, Email, Role, Active, Save Changes, Cancel. Display the current
  values and a Set New Initial Password action. Deactivation requires explicit
  confirmation explaining that sessions end. Role change warns that existing
  sessions end. Self-deactivation is unavailable with an explanation; server
  safety errors still cover direct requests and concurrent changes.
- Reset: New Initial Password and confirmation, password rules, and a confirm
  action explaining session revocation and mandatory next-login password change.
  Do not display a password after saving. A self-reset returns to Login.

Show loading, empty/no-results, saving/disabled, successful create/update/reset,
adjacent invalid/duplicate-email errors, forbidden, missing edited user,
last-admin/self-deactivation/assigned-owner conflicts, and safe API failures.
Assigned-owner conflicts explain that tickets must be reassigned first; offer
Ticket Queue navigation. Failed edits preserve entered values; Cancel makes no
API change. Successful operations refresh the list and focus its result message
or the edited row. On mobile use labelled user cards and a full-width form.

## 8. Feedback, Focus, and Accessibility

Every input has a visible associated label. Required markers include programmatic
required state; field messages use aria-describedby and aria-invalid. Give
icon-only controls an accessible name and tooltip. Text badges make state
readable without color; use contrast consistent with the existing theme.

On navigation move focus to the page heading; after validation focus the first
invalid field or a linked error summary. Announce loading/success with role=status
and blocking failures with role=alert. Native links/buttons support keyboard
activation; sorting exposes direction with aria-sort and a readable button name.

Dialogs have an accessible title and description, move and trap focus, support
Escape/Cancel before submission, and restore focus to the trigger on dismissal.
Keep focus visible on every control. Busy controls remain disabled with action
text; no spinner-only button. Long names, emails, comments, notes, and attachment
filenames wrap. Masking horizontal overflow is not an acceptable layout fix.

## 9. Responsive Rules and Visual Evidence

| Viewport | Layout |
|---|---|
| Desktop ≥992px | Centered forms/details up to the existing 1120px width; queue/user lists may use 1320px; useful multi-column groups |
| Tablet 768–991px | Two-column forms/filters where readable; full-width Summary/Description; list cards where a table no longer fits |
| Mobile <768px | One-column forms/filters/cards, wrapped or collapsible role navigation, touch-friendly actions, full-width dialogs |

At all sizes, no horizontal page scrolling, clipped labels, overlapping feedback,
hidden actions, or unreadable text. Check the 767/768 and 991/992 breakpoint
boundaries and capture populated major screens at 1440×1000, 820×1180, 390×844.

Planned screenshot directories under `artifacts/lab-03/screenshots/`:

- `authentication/`: Login, mandatory Change Password, current role, invalid/
  inactive feedback, busy state, safe failure, and logout denial.
- `requester/`: authenticated Create/My Tickets/Detail with active and removed
  Attachments, Public Comments, and resolution indication.
- `staff-queue/`: populated queue, controls/page changes, empty/no-results, and
  safe failure.
- `staff-ticket-detail/`: ownership/priority/status controls, confirmation,
  public/private sections, active download, indication, and conflicts.
- `user-management/`: list/create/edit/reset, validation, forbidden, safety
  conflicts, and safe failure.

The [test plan](tests.md) records style/responsive checks and manual inspection
results when performed. Screen modes and feedback above are requirements, not
claims that screenshots or implementation already exist.
