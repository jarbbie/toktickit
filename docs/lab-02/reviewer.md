# Lab 2 — Peer Review Record

**Author:** Peeranat Ngamkiatkajorn — 67070503429 — GitHub: @jarbbie
**Peer reviewer:** Peemmapat Sripongsai — 67070503436 — GitHub: @SupeemAFK

## Pull Requests I authored (reviewed by my partner)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#17](https://github.com/jarbbie/toktickit/pull/17) | feature/5-lab2-contract | Approved |
| [#20](https://github.com/jarbbie/toktickit/pull/20) | feature/6-db-seed | Approved |
| [#21](https://github.com/jarbbie/toktickit/pull/21) | feature/7-requester-context | Approved |
| [#23](https://github.com/jarbbie/toktickit/pull/23) | feature/9-create-ticket-ui | Approved |
| [#24](https://github.com/jarbbie/toktickit/pull/24) | feature/10-my-tickets | Approved |
| [#25](https://github.com/jarbbie/toktickit/pull/25) | feature/11-ticket-detail-attachments | Approved after changes |
| [#26](https://github.com/jarbbie/toktickit/pull/26) | feature/12-lab2-verification | Approved and merged |

---

[#17 feature/5-lab2-contract](https://github.com/jarbbie/toktickit/pull/17)
Reviewer:
```
Thanks! Please fix these 3 small things before I approve:

    docs/lab-02/ai-use.md: Fill in row 2 with a real prompt you used, and replace the Reflection placeholder with 2–3 sentences about how you used AI.

    docs/lab-02/reviewer.md: After this review, copy this review comment into Reviewer comment I received, then write a short How I responded note explaining the fixes you made.

    docs/lab-02/specification.md (BR-03): Add one sentence saying that, if the random ticket number already exists, the server generates a new number and tries again. This prevents a rare duplicate-number error.

After these changes, please request my review again I will approve.
```

Me:
```
Addressed in commit 4d78b91.

    Filled the second AI-use prompt and replaced the reflection placeholder.
    Recorded your review comment and my response in reviewer.md.
    Updated BR-03 so the server regenerates and retries if a random ticket number already exists.

Please re-review when convenient. Thank you.
```

Reviewer:
```
Approved.

The requested updates are complete:

    The AI-use record now has a real second prompt and reflection.
    The peer-review record includes the review feedback and response.
    BR-03 now requires retrying when a generated ticket number already exists.

I also rechecked the final diff for whitespace errors; it passes. There are no CI checks configured on this branch.
```

---

[#20 feature/6-db-seed](https://github.com/jarbbie/toktickit/pull/20)
Reviewer comment I received:
```
Approved.

The Lab 2 data foundation meets the required database increment:

    The Prisma schema and additive migration include the required models, enums, foreign keys, unique constraints, and indexes.
    The seed data is idempotent and includes the 4 required categories, 6 related systems, 4 active requesters, and 1 inactive requester.
    Local upload storage is correctly ignored.

I verified that Prisma schema validation passes, the new seed-data test passes, and the diff has no whitespace errors.
```

How I responded:
```
Thank you for approval jaa :D
```

---

[#21 feature/7-requester-context](https://github.com/jarbbie/toktickit/pull/21)
Reviewer:
```
Approved.

The requester context implementation meets the Lab 2 requirement for a temporary,
non-authentication requester selector:

- Active requesters, categories, and related systems are returned in name order.
- The selector handles loading, empty, retry, persistence, and Change Requester states.
- The new API and UI tests cover the new behavior.

I verified the client test suite and production build pass, and the diff has no
whitespace errors. No CI checks are configured on this branch.
```

How I responded: No changes were requested. The PR was merged into
`lab2-staging` after approval.

---

[#23 feature/9-create-ticket-ui](https://github.com/jarbbie/toktickit/pull/23)
Reviewer comment I received:
```
Approved. The Create Ticket screen meets the scoped requirements: generated
fields are read-only, reference data and validation are handled correctly, and
the busy, success, and safe-failure states are covered by UI tests. The router
also provides navigation, requester display, and Change Requester.
```

How I responded: No changes were requested. The PR was merged after approval.

---

[#24 feature/10-my-tickets](https://github.com/jarbbie/toktickit/pull/24)
Reviewer comment I received:
```
Request changes: pagination always requests page 1 because the update helper
resets the page. Keep the requested page for Previous/Next and add a UI test.
Also validate that the requester exists and is active before listing tickets,
with tests for inactive and missing requesters.
```

How I responded: In commit `590d723`, I preserved the requested page for
pagination, added the Next-page UI test, and validated active requester context
in the list API with regression tests. The reviewer then approved the PR.

---

[#25 feature/11-ticket-detail-attachments](https://github.com/jarbbie/toktickit/pull/25)
Reviewer comment I received:
```
Request changes: validate the actual PDF/PNG content signature rather than
trusting the submitted MIME type, rejecting mismatches with 415. Also make the
five-active-attachment limit safe for concurrent uploads by using a
transaction/lock and removing a stored file if that transaction fails.
```

How I responded: I added PDF/PNG/JPEG/WEBP signature checks, a per-ticket
transaction lock for the count-and-create decision, cleanup for failed writes,
and regression tests for a spoofed PDF and the guarded upload path. The reviewer
approved the corrected PR.

---

[#26 feature/12-lab2-verification](https://github.com/jarbbie/toktickit/pull/26)
Reviewer comment I received:
```
Request changes: the E2E flow removes the uploaded attachment without proving
that an owned active attachment can be downloaded. Use Playwright's download
event to verify the downloaded filename or content, then retain the removal and
blocked-download checks. Also capture or document readable active-download
evidence.
```

How I responded: I added an active-download event assertion for `evidence.pdf`,
captured `ticket-detail-active/1440x1000.png` before removal, and retained the
existing removal and missing-Download checks.

Reviewer approval:
```
Approved. The E2E flow now downloads the active attachment and verifies the
filename, captures the active Ticket Detail state before removal, retains the
removed-download check, and records the updated responsive and test evidence.
```

The PR was merged into `lab2-staging` after approval.

---

## Pull Requests I reviewed for my partner
[#22 feature/lab2-spec](https://github.com/SupeemAFK/TokTickIT-Individual-Sprints/pull/22) @SupeemAFK
Me:
```
Thanks—this is a clear, well-organized Lab 2 engineering contract. The scope, API behavior, UI states, acceptance criteria, and planned test traceability are strong.

Before approval, please expand Section 7: Data Changes in specification.md with the proposed Prisma design: model fields and types, primary/foreign keys, relationships, nullability, unique constraints, enums, timestamps, indexes, Attachment soft-removal fields, and the migration decision.

This is required in the contract stage by the Lab 2 sheet:

    Section 5: Required Database Increment
    Section 5.1: Required Relationships
    Section 5.2: Required Indexes or Constraints
    Section 8.10: Required specification.md Sections → Data Changes

The later data/requester Issue will implement the approved design in schema.prisma, migrations, seeds, and tests. Once the contract documents that design, I’m happy to approve.
```
Partner:
```
Addressed the requested contract change in the latest commit.

specification.md Section 7 now documents the proposed Prisma models, fields/types, primary and foreign keys, required and nullable fields, relationships, unique constraints, enums, timestamps, indexes, attachment soft-removal fields, referential actions, and an additive migration/seed strategy.

The reviewer record now also reflects this genuine request and response. Please re-review when convenient.
```
Me:
```
Approved!

The updated Lab 2 engineering contract now documents the required data design, including Prisma models, fields/types, relationships, foreign keys, enums, constraints, indexes, soft-removal fields, and migration/seed decisions.

This satisfies the Lab 2 requirements in Sections 5, 5.1, 5.2, and 8.10. The specification, API contract, UI specification, and test plan are consistent and provide a clear contract for the following implementation Issues.
```

---

[#23 feature/lab2-database](https://github.com/SupeemAFK/TokTickIT-Individual-Sprints/pull/23) @SupeemAFK
Me:
```
The Lab 2 schema and idempotent seed design look good. However, the new migration cannot apply to an existing Lab 1 database.

Category.updatedAt is added as TIMESTAMP NOT NULL without a default value or
backfill. Since Lab 1 already has seeded Category rows, PostgreSQL cannot create
that required column.

Please update the migration to:

    Add updatedAt as nullable.
    Backfill it from createdAt for existing rows.
    Change it to NOT NULL.

Then verify the migration works against a non-empty Lab 1 database. After that, I’m happy to approve.
```

Partner:
```
Addressed the migration compatibility issue in the latest commit.

The migration now adds Category.updatedAt as nullable, backfills every existing row from createdAt, and then enforces NOT NULL.

Verification:

    Applied the Lab 1 migration to a new isolated local database.
    Inserted two existing Category rows.
    Applied this Lab 2 migration successfully.
    Confirmed 2 of 2 existing rows received updatedAt equal to createdAt.
    Full server suite: 5 tests passed; TypeScript build passed.

Please re-review when convenient.
```

Me:
```
Approved!

The migration now safely supports existing Lab 1 Category rows: it adds updatedAt as
nullable, backfills it from createdAt, then enforces NOT NULL.

I also rechecked the schema validation, server tests, and TypeScript build successfully. The database schema, idempotent seed data, migration, and seed tests are ready to merge into lab2-staging.
```

---

[#24 feature/requester-context](https://github.com/SupeemAFK/TokTickIT-Individual-Sprints/pull/24) @SupeemAFK
Me:
```
Approved.

The Development Requester endpoint correctly returns active requesters in name order, and the selector implements loading, empty, retryable error, session-storage context, and Change Requester behavior.

The UI and API test coverage matches the Lab 2 requester-selection contract. Thanks for including the verification results.
```

Partner: Noticed successfully merged PR.

---

[#25 feature/create-ticket-api](https://github.com/SupeemAFK/TokTickIT-Individual-Sprints/pull/25) @SupeemAFK
Me:
```
Request changes:

docs/lab-02/tests.md marks API-02 as Pass, but its Final Results section still
says "Not run: this is the pre-implementation plan." Please update that section
to record the passing API test while keeping the remaining planned tests pending.
```

Partner:
```
Addressed the requested documentation correction in the latest commit. The Final
Results section now records the passing API-01, UI-01, and API-02 coverage and
explicitly leaves all remaining rows Planned. Verification remains green: server
10 tests, client 9 tests, and both TypeScript builds pass.
```

Me:
```
Request changes: malformed JSON sent to POST /api/tickets returns Express's
default HTML error page with a stack trace and server paths, rather than the
documented safe JSON error. Please add an express.json() parse-error handler
returning a safe 400 JSON response and cover it with a test.
```

Partner:
```
Addressed the malformed-JSON request. express.json() parse failures now return
400 with a safe JSON error and no HTML stack trace or server paths. Added focused
API coverage. The Create Ticket API tests, full server suite, and server
TypeScript build pass.
```

Me:
```
Approved. The malformed-JSON error is now a safe JSON 400 response and is
covered by an API test.
```

---

[#26 feature/create-ticket-ui](https://github.com/SupeemAFK/TokTickIT-Individual-Sprints/pull/26) @SupeemAFK
Me:
```
Request changes:

1. The three read-only system fields need the distinct read-only visual treatment
required by ui-spec.md, not only the readOnly attribute.
2. Please add the missing busy/disabled duplicate-submission test before marking
UI-02 Pass.
```

Partner:
```
Addressed both requested changes. The Requester, Ticket Date, and Ticket Number
fields now use the distinct pale gray-green read-only treatment. Added a
regression test that keeps submission pending, verifies the busy label and
disabled button, attempts a second click, and confirms only one API request
occurs. The Create Ticket UI, full client and server suites, and both builds pass.
```

Me:
```
Approved. The required read-only treatment is now applied, and the new
deferred-request test verifies the busy/disabled state prevents duplicate
submission.
```

---

[#27 feature/my-tickets-api](https://github.com/SupeemAFK/TokTickIT-Individual-Sprints/pull/27) @SupeemAFK
Me:
```
Request changes:

1. Require a positive safe-integer requesterId before listing tickets. Without
it, the ownership filter can be omitted. Return a safe 400 and add coverage.
2. API-03 needs search, every filter, non-default sort/direction, pagination,
and requester-context coverage before being marked Pass.
```

Partner:
```
Addressed both changes: GET /api/tickets now rejects an omitted requesterId
before querying, and API-03 covers search, filters, sorting, pagination,
malformed values, inactive requesters, and missing context.
```

Me:
```
Request changes: validate Number.isSafeInteger for numeric query IDs so an
oversized requesterId returns the documented 400 rather than Prisma's 500.
```

Partner:
```
Added positive safe-integer validation and an oversized requesterId regression
test; server tests and build pass.
```

Me:
```
Approved. Required requester-context and query-bound validation are enforced
and covered.
```

---

[#28 feature/my-tickets-screen](https://github.com/SupeemAFK/TokTickIT-Individual-Sprints/pull/28) @SupeemAFK
Me:
```
Request changes: My Tickets renders without its onOpenTicket callback, so a
selected ticket cannot open Ticket Detail. Wire the callback and add a UI test.
```

Partner:
```
Selecting a table row or mobile card now opens read-only Ticket Detail through
the requester shell, with a Back to My Tickets action and UI coverage.
```

Me:
```
Request changes: clickable desktop table rows are not focusable or keyboard
operable. Use a labelled native button or link for the open action.
```

Partner:
```
The desktop ticket number is now a labelled native button and the UI test opens
the ticket through that accessible control.
```

Me:
```
Approved. The accessible open control and UI coverage are complete.
```

---

[#29 feature/ticket-detail](https://github.com/SupeemAFK/TokTickIT-Individual-Sprints/pull/29) @SupeemAFK
Me:
```
Request changes: validate that the requester is active before Ticket Detail is
loaded, returning the same safe 404 for inactive context. Also align tests.md
and api-spec.md with the implemented detail scope.
```

Partner:
```
Ticket Detail now validates active requester context with regression coverage;
the test plan and API contract were updated to match the implemented scope.
```

Me:
```
Approved. Active-requester validation and the Ticket Detail contract evidence
are correct and tested.
```

---

[#30 feature/attachment-lifecycle](https://github.com/SupeemAFK/TokTickIT-Individual-Sprints/pull/30) @SupeemAFK
Me:
```
Request changes: handle Multer's oversized-file failure as a safe 413 JSON
response, implement upload/download/removal controls with confirmation, and add
attachment API/UI behavior and ownership coverage before marking the rows Pass.
```

Partner:
```
The size-limit error is now a safe 413 response. Ticket Detail has upload,
active download, removal reason, soft removal, and unavailable removed actions;
API/UI coverage and tests.md were updated.
```

Me:
```
Request changes: enable the creation-time attachment workflow, retain a created
ticket with a safe warning when its later upload fails, and complete successful
upload/download/removal and non-owner behavioral coverage.
```

Partner:
```
Create Ticket now uploads an optional allowed attachment after creation and
keeps the created ticket visible on upload failure. The missing behavioral
coverage and documentation were added.
```

Me:
```
Approved. The creation-time upload, safe post-creation failure, ownership,
size-limit, and removal-confirmation behavior are in place. A later PR will
cover the remaining non-blocking active-download/removal regression evidence.
```

---

[#31 feature/responsive-zen-green](https://github.com/SupeemAFK/TokTickIT-Individual-Sprints/pull/31) @SupeemAFK
Me:
```
Request changes: use Secondary Green (#0B7A46) for keyboard focus, remove the
global horizontal-overflow mask, add automated style coverage, and capture the
required responsive evidence.
```

Partner:
```
Focus now uses #0B7A46, global overflow suppression is removed, STYLE-01 was
added, and populated 1440px/768px/375px requester screenshots were recorded.
```

Me:
```
Request changes: add populated Create Ticket, My Tickets, and Ticket Detail
attachment screenshots at every required viewport and record the observations.
```

Partner:
```
All twelve artifact paths and responsive observations are now recorded,
including validation, focus, mobile cards, active attachment actions, and the
removed state.
```

Me:
```
Approved. Zen Green focus, responsive checks, and complete visual evidence are
implemented and verified.
```

---

[#32 feature/e2e-acceptance](https://github.com/SupeemAFK/TokTickIT-Individual-Sprints/pull/32) @SupeemAFK
Me:
```
Request changes: scope the soft-removal assertion to evidence.png's attachment
row. The generic Removed text matches an existing fixture and does not prove
the intended attachment was removed.
```

Partner:
```
The assertion now scopes to evidence.png and verifies that its Download and
Remove controls are unavailable after soft removal. The Playwright suite passes.
```

Me:
```
Approved. The E2E assertion now verifies the correct attachment lifecycle and
the complete test/build/whitespace verification passes.
```

---

[#33 feature/release-evidence](https://github.com/SupeemAFK/TokTickIT-Individual-Sprints/pull/33) @SupeemAFK
Me:
```
Request changes: reviewer.md needs linked genuine peer-review evidence showing
comments, author responses, and approvals. Do not fabricate this evidence.
```

Me:
```
Correction: collaborator evidence already exists on jarbbie/toktickit. Record
the genuine reviews on PRs #17, #20–#26, including request-changes, responses,
and approval outcomes.
```

Partner:
```
reviewer.md now links the eight genuine Lab 2 collaborator reviews and their
outcomes; no evidence was invented.
```

Me:
```
Approved. The reviewer record, GitHub timelines, AI-use record, README, and
verified application evidence are consistent.
```
