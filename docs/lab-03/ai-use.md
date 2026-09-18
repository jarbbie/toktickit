# Lab 3 AI Use and Reflection

## Model and Tools

Planning used OpenAI Codex in the terminal; the main planning session identified
its model as GPT-5. A delegated Codex agent authored the initial contract from
the task brief, the complete local labsheet, and the Lab 2 documents/code/tests.
Tools used include local PDF text extraction, repository search/read commands
through RTK, file patches, Prisma/PostgreSQL migration tools, and test/build
verification. Issue #37 implementation and its passing tests are now reflected
in the repository; later Lab 3 features remain unfinished.

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

## Agent Orchestration

The contract-authoring delegation asked the agent to read the task brief and
complete labsheet, inspect Lab 2, create the six contract documents, cross-check
them, run `git diff --check`, and commit documentation only. This is an agent
orchestration instruction, not an additional user prompt. The coordinating
agent explicitly required the log to contain only the four genuine prompts
available now rather than inventing two more for the initial contract.

## My Reflection

AI helped organize the labsheet into role permissions, migration decisions,
API/UI behavior, acceptance criteria, and a test plan before feature coding.
During Issue #37 it also exposed a dangerous automatic migration that would
have dropped populated Requester data, leading to a hand-written rename and an
isolated populated-schema test. The test plan was useful because it required
evidence for preservation and repeat-safe seeding instead of treating a valid
Prisma schema as proof that the database increment was complete.
