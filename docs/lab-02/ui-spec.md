# Lab 2 UI Specification

## Visual Foundation

| Token | Use |
|---|---|
| `#006B3C` | Header and primary actions |
| `#0B7A46` | Active navigation, hover, focus accents, links |
| `#EAF6EF` | Selected/success/subtle emphasis |
| `#F5F7F6` | Page background |
| White | Cards and editable controls |
| Dark charcoal-green | Main text |
| Dark red | Invalid field border and message |
| Amber | Warnings only |

Cards have a subtle border and restrained shadow. Read-only fields use a
distinct soft gray background. Labels sit above controls;
required fields have a red asterisk and a message directly below the invalid
control. Requested Priority and Current Status use compact text badges: pale
green/amber/red by priority and green for `NEW`, with text always visible. Use
a compact native sans-serif hierarchy: 15px body text, smaller control labels,
and clearly heavier page headings.

Spacing uses a 4px base rhythm: 8px for tightly related controls, 12–16px
inside compact groups, 20–24px between cards or major sections, and 32–48px
for page-level vertical padding. Table rows use compact 8px vertical cell
padding with thin separators rather than artificial row margins.

## Buttons and Component States

| Role | Style |
|---|---|
| Primary | Solid `#006B3C`, white text; reserved for Submit, Continue, Create, and confirmation actions |
| Secondary | White or transparent with a green outline; used for navigation and non-destructive alternatives |
| Tertiary | Text or neutral-outline treatment for Clear, Cancel, and low-emphasis actions |
| Destructive | White/red outline before confirmation and solid dark red for the confirmed removal action |
| Disabled | Reduced contrast, unavailable pointer behavior, and native `disabled` semantics |
| Busy | Keeps visible action text, changes it to an active verb, and remains disabled until completion |

Priority and status badges are compact title-case pills with fully rounded
corners, a pale semantic background, matching thin border, and readable dark
text. My Tickets uses secondary-green header text and charcoal-green body text.

## Application Shell

The requester shell uses the reference-style compact green navigation bar,
profile menu, breadcrumb, and read-only ticket-detail field grid. It retains
only Lab 2 requester features; excluded IT staff actions are not shown.

The shell uses a `#006B3C` header with white TokTickIT identity, navigation,
selected requester name, and Change Requester action. The active route uses a
subtle tint and white underline; focus remains visible. Change Requester clears
requester-specific screen data and returns to the selector.

## Development Requester Selector

Show the shared shell, breadcrumb, title, a statement that it is for Lab 2
testing only and not login, requester dropdown, active-requester notice, Lab 3
authentication notice, and Cancel/Continue actions. Continue is disabled until
a requester is selected. Include loading, empty, and API-error states. All
controls are keyboard accessible.

## Create Ticket

Display requester and system-generated fields as read-only. Editable controls
are Category, Related System, Requested Priority, Summary, Description, and
one optional Attachment. Additional files are added from Ticket Detail.
Category/Related System show reference-data loading and failure
states. Submit is the primary green action and becomes disabled with visible
busy text while saving. On success, show the generated Ticket Number and a
clear My Tickets next action. On API failure, show a safe error and keep form
values and the selected file. Invalid attachments show an adjacent file-specific
message. If the Ticket is created but its attachment upload fails, show the
official Ticket Number, a warning, and a Ticket Detail action for retrying.

## My Tickets

Provide search, category/priority/status filters, sortable table headers, clear
filters, numbered pagination, and Create Ticket action. Desktop shows Ticket
Number, Created Date, Summary, Category, Requested Priority, Status, and Last
Updated; the Ticket Number opens the detail screen.
Smaller screens use readable cards or an equivalent responsive representation.
Use different wording for an empty requester with no tickets and a search with
no matching tickets.

## Requester Ticket Detail and Attachments

Show ticket information read-only. Separate attachment metadata/actions from
ticket information. Active attachments show download and Remove actions;
removed attachments show retained metadata, removed state, and no download or
preview action. Removal requires a reason and confirmation. Upload has visible
busy, validation, and failure feedback.

## Responsive Rules

| Viewport | Layout |
|---|---|
| Desktop ≥992px | Centered maximum-width content; multi-column form and table |
| Tablet 768–991px | Two columns where useful; Summary/Description remain wide |
| Mobile <768px | One column, touch-friendly buttons, collapsible/responsive navigation |

At every size: no horizontal page scroll, clipped labels, overlapped messages,
hidden buttons, or unreadable attachment names.

## Accessibility and Visual Checks

- Every input has a visible label; icon-only controls have an accessible name
  and tooltip.
- Keyboard focus is always visible; color is never the only status indicator.
- Disabled and busy controls cannot be activated.
- Verify initial, loading, validation, submitting, success, API failure, empty,
  no-results, active attachment, invalid attachment, and removed attachment
  states.
- Capture desktop, tablet, and mobile screenshots under
  `artifacts/lab-02/screenshots/` for Requester Selection
  `screenshots/requester-selection/`, Create Ticket `screenshots/create-ticket/`,
  My Tickets `screenshots/my-tickets/`, and Ticket Detail
  `screenshots/ticket-detail/`.
