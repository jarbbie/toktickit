# Lab 3 AI Use and Reflection

## Model and Tools

Planning and implementation used OpenAI Codex in the terminal; the main
planning session identified its model as GPT-5. A delegated Codex agent authored
the initial contract from the task brief, the complete local labsheet, and the
Lab 2 documents/code/tests. Tools used include local PDF text extraction,
repository search/read commands through RTK, file patches, Prisma/PostgreSQL
migration tools, GitHub issue/PR inspection, and test/build verification. The
session also used AI to respond to peer-review feedback, add the authenticated
Staff Ticket Detail integration fix, implement the Issue #44 Administrator API
with direct authorization and safety-rule tests, and implement the Issue #45
Administrator User Management screen with client-side state and API tests.
Human peer review remains the approval authority.

## Selected Genuine User Prompts

These prompts are genuine Lab 3 prompts from the planning and implementation
sessions. Their wording is retained, including informal phrasing.

| # | Actual user prompt | Use in planning |
|---|---|---|
| 1 | “read @~/School/swe/Lab3_Labsheet.pdf and begin to plan lab3 tickers” | Established the labsheet as the source for Lab 3 scope and planning. |
| 2 | “revise my issue and pr number” | Directed review of issue/PR numbering in the planned work. |
| 3 | “Implement the plan.” | Authorized execution of the planned sprint, starting with the engineering contract. |
| 4 | “sure, and shouldn't skills-lock.json should also be tracked?” | Clarified treatment of agent tooling configuration alongside the implementation workflow. |
| 5 | “wait before push and open PR, is everything fine? does Stakeholder request been intepret functional requirement and business rules correctly? does the test set up for this lab is correct and would check every case written in the labsheet for this lab 3?” | Triggered a line-by-line contract and test-plan audit before the contract PR. |
| 6 | “Continue until the issue #37 is finish, make it perfect” | Directed completion of the preservation migration, idempotent seed, regression tests, and verification rather than stopping after schema changes. |
| 7 | “PR #55 Request Changes, my friend response: I found one blocking integration issue...” | Converted the reviewer’s route-wiring finding into a concrete Shell integration fix and regression test. |
| 8 | “Before continue, let's check documents and artifacts” | Audited required Lab 3 files, test traceability, screenshot directories, E2E structure, and final-submission gaps before continuing implementation. |
| 9 | “Let's continue to next issue, also update reviewer.md and ai-use.md” | Started the Administrator API increment while updating review history and this AI-use record from actual repository evidence. |
| 10 | “Let's go to the next issue, update reviewer.md, ai-use.md” | Continued into Issue #45, using the merged API contract to shape the Administrator list, create/edit/reset states, safe errors, and focused UI tests before updating the records again. |

## Agent Orchestration

The contract-authoring delegation asked the agent to read the task brief and
complete labsheet, inspect Lab 2, create the six contract documents, cross-check
them, run `git diff --check`, and commit documentation only. This is an agent
orchestration instruction, not an additional user prompt. Later implementation
work was coordinated in the main session, with each prompt above retained from
the actual conversation rather than reconstructed after the fact.

## My Reflection

AI helped organize the labsheet into role permissions, migration decisions,
API/UI behavior, acceptance criteria, and a test plan before feature coding.
During Issue #37 it exposed a dangerous automatic migration that would have
dropped populated Requester data, leading to a hand-written rename and an
isolated populated-schema test. During Issue #43, peer-review feedback helped
identify that a valid component was wired outside the authenticated Shell; the
resulting App-level test checked navigation and logout rather than only the
component in isolation. For Issue #44, AI accelerated repetitive API and test
scaffolding, but I kept the contract as the authority, checked transaction and
authorization behavior, and treated passing mocked tests as separate from the
remaining PostgreSQL concurrency and browser evidence. For Issue #45, AI helped
turn the API DTOs into a responsive, labelled management screen and focused
tests; I still checked that password values are never rendered, drafts survive
safe conflicts, and Requesters cannot reach the route. The UI suite is
component evidence, not the final responsive/browser proof reserved for Issue
#46. This keeps AI useful for implementation and review preparation without
claiming completion from code or test output alone.
