# Lab 1 — Peer Review Record

**Author:** Peeranat Ngamkiatkajorn — 67070503429 — GitHub: @jarbbie
**Peer reviewer:** Phattaratorn Mahatkeerati — 67070503433 — GitHub: @GGital

My repository: [jarbbie's Repository](https://github.com/jarbbie/toktickit)

My partner's repository: [GGital's Repository](https://github.com/GGital/TocktickIT)

## Pull Requests I authored (reviewed by my partner)
| Issue |  PR  | Branch | Reviewer verdict |
|-------|------|--------|------------------|
| [#1 Project Foundation](https://github.com/jarbbie/toktickit/issues/1) | [PR #5](https://github.com/jarbbie/toktickit/pull/5) | feature/1-project-foundation | Approved |
| [#2 API Health check](https://github.com/jarbbie/toktickit/issues/2) | [PR #6](https://github.com/jarbbie/toktickit/pull/6) | feature/2-health-check | Approved |
| [#3 Create and seed categories](https://github.com/jarbbie/toktickit/issues/3) | [PR #7](https://github.com/jarbbie/toktickit/pull/7) | feature/3-category-seed | Approved |
| [#4 Display the category list](https://github.com/jarbbie/toktickit/issues/4) | [PR #8](https://github.com/jarbbie/toktickit/pull/8) | feature/4-category-list | Approved |

Reviewer comments & My responses:

PR: [PR #5](https://github.com/jarbbie/toktickit/pull/5)
Reviewer comment I received: LGTM. This merge request does meet all acceptance criteria. API and frontend behavior are working correctly with the secrets not being exposed to the VCS and tools for testing are ready to go. You're good to go.
How I responded: Merged the commit into `lab1-staging`

PR: [PR #6](https://github.com/jarbbie/toktickit/pull/6)
Reviewer comment I received: I have tested curl directly to the /api/health endpoint and got HTTP 200 with response as expected. Response: { "status": "ok", "service": "TokTickIT API" } Written Supertest test really does verify the endpoint and the React page is showing the status based on a real API call confirmed after trying while API is online and offline. LGTM This is ready to be merged
How I responded: Merged the commit into `lab1-staging`

PR: [PR #7](https://github.com/jarbbie/toktickit/pull/7)
Reviewer comment I received: The migration and schema are correct due to the design. The seed correctly inserted data and safe to run more than one without duplicates. The .env file containing database credential is not committed. This is ready to be merged.
How I responded: Merged the commit into `lab1-staging`

PR: [PR #8](https://github.com/jarbbie/toktickit/pull/8)
Reviewer comment I received: The api is working correctly to obtain categories from PostgreSQL through Prisma and the client map the result of querying from the /api/categories to the categories to be shown on the client correctly. Supertest and Vitest test cases are correctly and the application pass all of the test. Loading and error states are correctly shown due to status of API and DB. LGTM This is ready to be merged
How I responded: Merged the commit into `lab1-staging`

## Pull Requests I reviewed for my partner

PR: [GGital/TocktickIT/PR #5](https://github.com/GGital/TocktickIT/pull/5)
My comment: Reviewed the implementation against the Lab 1 acceptance criteria. The API endpoint, tests, and frontend behavior look correct. I also checked that secrets are excluded from the repository. Approved 😁
Partner's response: Merged the commit into `lab1-staging`

PR: [GGital/TocktickIT/PR #6](https://github.com/GGital/TocktickIT/pull/6)
My comment: I tested /api/health, the body contain correct info. Supertest test passed successfully. React page shows system status as it should. LGTM 🫶
Partner's response: Merged the commit into `lab1-staging`

PR: [GGital/TocktickIT/PR #7](https://github.com/GGital/TocktickIT/pull/7)
My comment: LGTM — Category model ✅ / Category table ✅ / Seed ✅ / Safe credential ✅
Partner's response: Merged the commit into `lab1-staging`

PR: [GGital/TocktickIT/PR #8](https://github.com/GGital/TocktickIT/pull/8)
My comment: GET /api/categories could retrieves categories. React displays custom added values. Test passed. Good job, well done! ヽ༼ຈل͜ຈ༽ﾉ
Partner's response: Merged the commit into `lab1-staging`