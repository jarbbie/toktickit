# Lab 3 AI Use and Reflection

## Model and Tools

Planning used OpenAI Codex in the terminal; the main planning session identified
its model as GPT-5. A delegated Codex agent authored the initial contract from
the task brief, the complete local labsheet, and the Lab 2 documents/code/tests.
Tools used for this contract include local PDF text extraction, repository
search/read commands through RTK, file patches, and Git verification. No Lab 3
feature implementation or passing product test run is claimed here.

## Selected Genuine User Prompts

These four prompts are the genuine Lab 3 user prompts available at the time of
initial contract authoring, recorded from the planning session. Their wording
is retained, including informal phrasing. The sprint log will be maintained
through implementation to reach the labsheet's final 6–10 selected prompts;
additional user prompts will be recorded only after they occur.

| # | Actual user prompt | Use in planning |
|---|---|---|
| 1 | “read @~/School/swe/Lab3_Labsheet.pdf and begin to plan lab3 tickers” | Established the labsheet as the source for Lab 3 scope and planning. |
| 2 | “revise my issue and pr number” | Directed review of issue/PR numbering in the planned work. |
| 3 | “Implement the plan.” | Authorized execution of the planned sprint, starting with the engineering contract. |
| 4 | “sure, and shouldn't skills-lock.json should also be tracked?” | Clarified treatment of agent tooling configuration alongside the implementation workflow. |

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
The useful part of this stage is making choices explicit, especially the
difference between the submitting Requester and the staff Ticket Owner and the
separation of Public Comments from Internal Notes. This is an initial reflection:
implementation, migration rehearsal, peer feedback, and final verification
still need evidence before I can judge whether those choices worked in practice.
