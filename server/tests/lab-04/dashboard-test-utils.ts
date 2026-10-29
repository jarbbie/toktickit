import type { PrismaClient, RequestedPriority, Ticket, TicketStatus, TicketStatusEvent, UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { hashSessionToken } from "../../src/auth.js";
import { setPrismaForTests } from "../../src/prisma.js";
import { applyMigration, testDatabaseEnabled, withIsolatedSchema } from "./database-test-utils.js";

const migrations = [
  "20260809101008_init",
  "20260825000000_lab2_ticketing",
  "20260918000000_lab3_data_foundation",
  "20261028000000_lab4_data_foundation",
];

type DashboardUser = { id: number; name: string; email: string; role: UserRole };
type TicketOptions = {
  requesterId?: number;
  ownerId?: number | null;
  status?: TicketStatus;
  itPriority?: RequestedPriority;
  summary?: string;
  updatedAt?: Date;
};

export type DashboardFixture = {
  prisma: PrismaClient;
  users: { requester: DashboardUser; otherRequester: DashboardUser; staff: DashboardUser; otherStaff: DashboardUser; admin: DashboardUser };
  cookies: { requester: string; otherRequester: string; staff: string; otherStaff: string; admin: string };
  ticket(options?: TicketOptions): Promise<Ticket>;
  statusEvent(ticketId: number, fromStatus: TicketStatus, toStatus: TicketStatus, changedAt: Date): Promise<TicketStatusEvent>;
};

export async function withDashboardApi(run: (fixture: DashboardFixture) => Promise<void>) {
  await withIsolatedSchema(async (prisma) => {
    for (const migration of migrations) await applyMigration(prisma, migration);
    const userSpecs = [
      { key: "requester", role: "REQUESTER", name: "Dashboard Requester", emailPrefix: "dashboard.requester" },
      { key: "otherRequester", role: "REQUESTER", name: "Other Requester", emailPrefix: "dashboard.other-requester" },
      { key: "staff", role: "IT_STAFF", name: "Dashboard Staff", emailPrefix: "dashboard.staff" },
      { key: "otherStaff", role: "IT_STAFF", name: "Other Staff", emailPrefix: "dashboard.other-staff" },
      { key: "admin", role: "ADMINISTRATOR", name: "Dashboard Admin", emailPrefix: "dashboard.admin" },
    ] as const;
    const userEntries = await Promise.all(userSpecs.map(async ({ key, role, name, emailPrefix }) => {
      const user = await prisma.user.create({ data: { name, email: `${emailPrefix}.${randomUUID()}@test.local`, role, mustChangePassword: false } });
      const token = randomUUID();
      await prisma.session.create({ data: { userId: user.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 60_000) } });
      return [key, { user, cookie: `toktickit_session=${token}` }] as const;
    }));
    const usersByKey = new Map(userEntries);
    const account = (key: (typeof userSpecs)[number]["key"]) => usersByKey.get(key)!;
    const category = await prisma.category.create({ data: { name: `Dashboard ${randomUUID()}` } });
    const system = await prisma.relatedSystem.create({ data: { name: `Dashboard ${randomUUID()}` } });
    let sequence = 0;
    const fixture: DashboardFixture = {
      prisma,
      users: {
        requester: account("requester").user,
        otherRequester: account("otherRequester").user,
        staff: account("staff").user,
        otherStaff: account("otherStaff").user,
        admin: account("admin").user,
      },
      cookies: {
        requester: account("requester").cookie,
        otherRequester: account("otherRequester").cookie,
        staff: account("staff").cookie,
        otherStaff: account("otherStaff").cookie,
        admin: account("admin").cookie,
      },
      ticket: (options = {}) => {
        sequence += 1;
        return prisma.ticket.create({ data: {
          ticketNumber: `DASH-${randomUUID().slice(0, 12)}-${sequence}`,
          requesterId: options.requesterId ?? account("requester").user.id,
          ownerId: options.ownerId ?? null,
          categoryId: category.id,
          relatedSystemId: system.id,
          status: options.status ?? "NEW",
          itPriority: options.itPriority ?? "MEDIUM",
          summary: options.summary ?? `Dashboard Ticket ${sequence}`,
          description: "Dashboard API fixture.",
          ...(options.updatedAt ? { updatedAt: options.updatedAt } : {}),
        } });
      },
      statusEvent: (ticketId, fromStatus, toStatus, changedAt) => prisma.ticketStatusEvent.create({ data: {
        ticketId, fromStatus, toStatus, actorId: account("staff").user.id, changedAt,
      } }),
    };
    setPrismaForTests(prisma);
    try {
      await run(fixture);
    } finally {
      setPrismaForTests(null);
    }
  });
}

export { testDatabaseEnabled };
