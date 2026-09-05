# Lab 2 — AI Use and Reflection

**LLM/agent used:** I used the Codex cli on my terminal.  I mainly used gpt-5.6-terra as the LLM with a thinking level of Medium.

## Selected key prompts
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | It's all good now. Back to the project. can you summarize what does this project cover. the summarization can be long to cover everything. I prioritize organization of the summary. | Summarize and clarify things that need to be done in Lab 2 |
| 2 | Recheck the database design and fix `specification.md` if needed. | Reviewed the Lab 2 data requirements, then added the proposed Prisma models, fields, relations, constraints, and indexes to the contract. |
| 3 | Start Issue 13: Development Requester selection and reference data. Implement only the temporary requester context, active-only APIs, selector states, and tests. | Used the proposed scope to keep the branch limited to three reference-data endpoints, session-based requester selection, and focused API/UI tests. |
| 4 | Test everything for the requester-context branch and check whether it is ready for a one-shot PR. | Reviewed the branch diff, ran migration/seed, server and client tests, and both builds; then identified and repaired the local PostgreSQL port mapping needed for database-backed verification. |
| 5 | PR #21 already merged, maybe move to next issue. | Updated the staging branch, created the Ticket creation API branch, and reviewed the approved contract before writing focused tests. |
| 6 | Add 1-2 more prompt to ai-use.md; check if tests.md have to update. | Checked the test-plan traceability, confirmed the Unit and Ticket API results were already recorded, then added this AI-use evidence. |
| 7 | Do this final issue: Lab 2 E2E, responsive evidence, and release verification. | Used the result to add two focused Playwright flows, save the required viewport screenshots, and update the release evidence without adding unrelated test infrastructure. |
| 8 | My friend reviewed PR #25 and requested actual file-signature validation and a concurrency-safe five-attachment limit. Check it and fix it. | Used the review to trace the upload path, then added server-side signature checks, a transaction lock around the limit, and focused regression tests. |
| 9 | Read the Lab 2 sheet and audit the completed project before final submission; create a corrective branch and fix every remaining mismatch. | Compared the final implementation and evidence with the handout, then used a fix-forward branch to add Create Ticket attachments, safe oversized-body handling, deterministic sorting, missing tests/screenshots, and documentation corrections. |
| 10 | I saw you talked about Playwright in `tests.md`; can we set it up now? | Used the advice to defer browser-test setup until the final verification issue, where it could cover the completed end-to-end workflow and produce the required responsive evidence. |

## Reflection
I used AI to turn the Lab 2 handout into an engineering contract and to plan
small, dependency-aware issues, then checked those decisions against the handout.
For each increment, I used AI-assisted implementation and review, but verified
the API/UI behavior, database migrations, builds, and tests myself. For the final
release check, I ran the Playwright flows against PostgreSQL and manually inspected
the generated desktop and mobile screenshots. A final compliance audit helped me
find and verify missing boundary cases without rewriting the repository's public
history.
