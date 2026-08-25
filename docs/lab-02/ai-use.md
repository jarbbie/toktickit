# Lab 2 — AI Use and Reflection

**LLM/agent used:** I used the Codex cli on my terminal.  I mainly used gpt-5.6-terra as the LLM with a thinking level of Medium.

## Selected key prompts
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | It's all good now. Back to the project. can you
  summarize what does this project cover. the
  summarization can be long to cover everything. I
  prioritize organization of the summary. | Summarize and clarify things that need to be done in Lab 2 |
| 2 | Recheck the database design and fix `specification.md` if needed. | Reviewed the Lab 2 data requirements, then added the proposed Prisma models, fields, relations, constraints, and indexes to the contract. |
| 3 | Start Issue 13: Development Requester selection and reference data. Implement only the temporary requester context, active-only APIs, selector states, and tests. | Used the proposed scope to keep the branch limited to three reference-data endpoints, session-based requester selection, and focused API/UI tests. |
| 4 | Test everything for the requester-context branch and check whether it is ready for a one-shot PR. | Reviewed the branch diff, ran migration/seed, server and client tests, and both builds; then identified and repaired the local PostgreSQL port mapping needed for database-backed verification. |

## Reflection
I used AI to turn the Lab 2 handout into an initial engineering contract, then
reviewed each decision against the handout. For Issue 13, I used focused prompts
to keep the work limited to requester context and reference data, and verified
the resulting API, UI states, and local database setup myself.
