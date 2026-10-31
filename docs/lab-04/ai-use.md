# Lab 4 AI Use Record

**LLM used:** OpenAI Codex assistant (GPT-6 family; exact product model label
should be checked in the session UI before final submission).

This is a selected-prompt log, not a transcript. The entries below are actual
user requests from the planning and implementation conversation. The result
notes summarize how each response was used.

## Selected Prompts and Results

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | “Read ~/School/swe/Lab4_Labsheet.pdf” | Read the handout and used its deliverables and evidence requirements to frame the work. |
| 2 | “Explain tasks throughout this entire lab.” | Used the overview to understand the nine submission parts and how the implementation tasks fit together. |
| 3 | “Explain tasks throughout this entire lab. Answer simply, encourage using symbol to shorten things down.” | Asked for a simpler explanation so I could follow the scope and task order before planning. |
| 4 | “Start doing the lab.” | Began implementation too early; after correcting the order, the premature attempt was reverted. |
| 5 | “Did you already implement it? I thought first issue is to plan everything first” | Returned to contract-first planning and kept Issue #67 focused on the engineering contract. |
| 6 | “back to last git stage and lets understand the Labsheet then satart with planning issues” | Re-read the handout, restored the prior Git stage, and planned the issue sequence before coding. |
| 7 | “should we create a local backlog and create a gitignore for it, for tracking progress” | Used the discussion to organize local progress tracking and decide which scratch files should stay ignored. |
| 8 | “Start” | Started Issue #67 in the documentation and planning phase before feature implementation. |
| 9 | “My friend merged PR, lets do next task” | Checked the merge state and advanced to the next planned increment. |
| 10 | “Lets start” | Began the Actions API increment after PR #77 merged, using the reviewed contract and data foundation. |

## Reflection

**My Reflection — pending student input.** The student should replace this
placeholder with their own short account of how they used specification
feedback and coding help, what they checked or changed, and what they learned.
An AI cannot truthfully write the student's personal reflection for them.

## Accuracy Notes

The first implementation attempt was reverted to the latest main commit after
the student corrected the order. Issue #67 was kept to documentation/planning.
The contract and the subsequent #68 data foundation have since been merged.

For Issue #69, the assistant implemented Action API validation, authorization,
idempotency, concurrency locking, DTOs and audit writes, and drafted PostgreSQL
API tests. It also added an isolated full-server test runner because inherited
database suites used the application's database URL. On 2026-10-29, the server
build passed and the isolated server suite passed all 124 tests, including 15
Action API cases. The student and peer should review the implementation and
the recorded results before accepting the new PR. Student reflection above
remains pending; these automated checks do not constitute a personal reflection.
