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
distinct soft gray-green or warm ivory background. Labels sit above controls;
required fields have a red asterisk and a message directly below the invalid
control.

## Application Shell

The shell displays TokTickIT, My Tickets, Create Ticket, selected requester
name, and Change Requester. The active route has a non-color indicator as well
as its green style. Change Requester clears requester-specific screen data and
returns to the selector.

## Development Requester Selector

Show title, a statement that it is for Lab 2 testing only and not login,
requester dropdown, Continue button, loading state, empty state, and API-error
state. Continue is disabled until a requester is selected. All controls are
keyboard accessible.

## Create Ticket

Display requester and system-generated fields as read-only. Editable controls
are Category, Related System, Requested Priority, Summary, Description, and
Attachments. Category/Related System show reference-data loading and failure
states. Submit is the primary green action and becomes disabled with visible
busy text while saving. On success, show the generated Ticket Number and a
clear My Tickets next action. On API failure, show a safe error and keep form
values. Invalid attachments show an adjacent file-specific message.

## My Tickets

Provide search, category/priority/status filters, sort control, clear filters,
pagination, and Create Ticket action. Desktop shows Ticket Number, Summary,
Category, Requested Priority, Status, Last Updated, and an open action.
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
  `artifacts/lab-02/screenshots/` for Create Ticket, My Tickets, and Ticket
  Detail.
