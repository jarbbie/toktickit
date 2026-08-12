# Lab 1 — Test Plan and Evidence

All test files live under server/tests/lab-01/ and client/tests/lab-01/.

| # | Tool | Test | Result |
|---|------|------|--------|
| 1 | Supertest | GET /api/health returns 200, status=ok | PASS |
| 2 | Supertest | GET /api/categories returns 4 seeded categories in id order | PASS |
| 3 | Vitest | Heading renders | PASS |
| 4 | Vitest | Success state shows Online + category list | PASS |
| 5 | Vitest | Error state shows Offline + message | PASS |

### **Evidences**:

Client tests:

![Client Test](assets/client-test.png)

Server tests:

![Server Test](assets/server-test.png)
