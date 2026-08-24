# Lab 2 — Peer Review Record

**Author:** Peeranat Ngamkiatkajorn — 67070503429 — GitHub: @jarbbie
**Peer reviewer:** Peemmapat Sripongsai — 67070503436 — GitHub: @SupeemAFK

## Pull Requests I authored (reviewed by my partner)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#17](https://github.com/jarbbie/toktickit/pull/17) | feature/5-lab2-contract |  |

[feature/5-lab2-contract](https://github.com/jarbbie/toktickit/pull/17)
Reviewer comment I received: <...>
How I responded: <...>

## Pull Requests I reviewed for my partner
[feature/lab2-spec](https://github.com/SupeemAFK/TokTickIT-Individual-Sprints/pull/22) by @SupeemAFK
My comment:
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
Partner's response:
```
Addressed the requested contract change in the latest commit.

specification.md Section 7 now documents the proposed Prisma models, fields/types, primary and foreign keys, required and nullable fields, relationships, unique constraints, enums, timestamps, indexes, attachment soft-removal fields, referential actions, and an additive migration/seed strategy.

The reviewer record now also reflects this genuine request and response. Please re-review when convenient.
```
My comment:
```
Approved!

The updated Lab 2 engineering contract now documents the required data design, including Prisma models, fields/types, relationships, foreign keys, enums, constraints, indexes, soft-removal fields, and migration/seed decisions.

This satisfies the Lab 2 requirements in Sections 5, 5.1, 5.2, and 8.10. The specification, API contract, UI specification, and test plan are consistent and provide a clear contract for the following implementation Issues.
```
