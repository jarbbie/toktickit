import type { ActionStatus, PrismaClient, RequestedPriority, TicketStatus, UserRole } from "@prisma/client";
import { createHash } from "node:crypto";
import argon2 from "argon2";

export const initialPassword = "Lab3-Initial-2026!";
const hashOptions = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const categories = ["Account and Access", "Hardware", "Software", "Network"] as const;
export const relatedSystems = ["Email", "Campus Wi-Fi", "VPN", "LEB2 App", "Grade Submission App", "Printer"] as const;
export const requesters = [
  { name: "Nicha Somchai", email: "nicha.somchai@toktickit.test", isActive: true },
  { name: "Anan Kittisak", email: "anan.kittisak@toktickit.test", isActive: true },
  { name: "Mali Charoen", email: "mali.charoen@toktickit.test", isActive: true },
  { name: "Preecha Wattanakul", email: "preecha.wattanakul@toktickit.test", isActive: true },
  { name: "Suda Inactive", email: "suda.inactive@toktickit.test", isActive: false },
] as const;

export const staffUsers = [
  { name: "Support One", email: "support.one@toktickit.test", role: "IT_STAFF", isActive: true },
  { name: "Support Two", email: "support.two@toktickit.test", role: "IT_STAFF", isActive: true },
  { name: "Support Three", email: "support.three@toktickit.test", role: "IT_STAFF", isActive: true },
  { name: "Support Inactive", email: "support.inactive@toktickit.test", role: "IT_STAFF", isActive: false },
  { name: "Lab Administrator", email: "admin@toktickit.test", role: "ADMINISTRATOR", isActive: true },
] as const;

export const lab4DashboardUsers = [
  { name: "Requester Without Tickets", email: "empty.dashboard@toktickit.test", role: "REQUESTER", isActive: true },
  { name: "Support Without Ownership", email: "support.empty.dashboard@toktickit.test", role: "IT_STAFF", isActive: true },
] as const;

const statuses: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
const priorities: RequestedPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export const ticketFixtures = Array.from({ length: 24 }, (_, index) => ({
  ticketNumber: `TKT-2026-LAB3${String(index + 1).padStart(4, "0")}`,
  summary: ["Cannot connect to VPN", "Email delivery is delayed", "Laptop battery drains quickly", "Printer queue is stuck", "Campus Wi-Fi disconnects", "Grade submission page fails"][index % 6],
  description: `Lab 3 seeded support request ${index + 1} used for local workflow testing.`,
  status: statuses[index % statuses.length],
  requestedPriority: priorities[index % priorities.length],
  itPriority: priorities[(index + 1) % priorities.length],
  requesterIndex: index % requesters.filter(({ isActive }) => isActive).length,
  ownerIndex: index % 4 === 0 ? null : index % 3,
  categoryIndex: index % categories.length,
  relatedSystemIndex: index % relatedSystems.length,
}));

export const recentResolvedTicketFixture = {
  ticketNumber: "TKT-2026-L4DASH01",
  summary: "Confirm the dashboard resolution window",
  description: "Seeded Lab 4 Ticket with a recorded recent resolution.",
  requestedPriority: "HIGH" as const,
  itPriority: "URGENT" as const,
  requesterIndex: 0,
  ownerIndex: 0,
  categoryIndex: 0,
  relatedSystemIndex: 1,
};

export const recentResolvedActionFixture = {
  key: "00000000-0000-4000-8000-000000000005",
  performerIndex: 0,
  assigneeIndex: null,
  actionAt: "2026-10-27T06:00:00.000Z",
  description: "Verify the requested service after completing the repair.",
  followUpRequired: false,
  followUpNote: null,
  attachmentNotes: null,
  targetStatus: "COMPLETED" as const,
  result: "The requester confirmed the service is working again.",
};

export const actionFallbackTicketFixture = {
  ticketNumber: "TKT-2026-L4ACT01",
  summary: "Lab 4 Action workflow samples",
  description: "Dedicated active Ticket for sample Actions when legacy examples are terminal.",
  requestedPriority: "MEDIUM" as const,
  itPriority: "HIGH" as const,
  requesterIndex: 0,
  ownerIndex: 0,
  categoryIndex: 1,
  relatedSystemIndex: 1,
};

export const actionFixtures = [
  {
    key: "00000000-0000-4000-8000-000000000001",
    ticketIndex: 0,
    performerIndex: 0,
    assigneeIndex: 1,
    actionAt: "2026-10-26T02:30:00.000Z",
    description: "Inspect the requester account and reproduce the access issue.",
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: "No additional attachment was supplied.",
    targetStatus: "PLANNED" as const,
    result: null,
  },
  {
    key: "00000000-0000-4000-8000-000000000002",
    ticketIndex: 0,
    performerIndex: 1,
    assigneeIndex: 0,
    actionAt: "2026-10-27T03:15:00.000Z",
    description: "Refresh the access token and verify the VPN connection.",
    followUpRequired: true,
    followUpNote: "Confirm connection stability with the requester tomorrow.",
    attachmentNotes: null,
    targetStatus: "IN_PROGRESS" as const,
    result: null,
  },
  {
    key: "00000000-0000-4000-8000-000000000003",
    ticketIndex: 1,
    performerIndex: 2,
    assigneeIndex: 2,
    actionAt: "2026-10-27T04:00:00.000Z",
    description: "Update the mailbox configuration and verify delivery.",
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    targetStatus: "COMPLETED" as const,
    result: "Mail delivery is restored and verified.",
  },
  {
    key: "00000000-0000-4000-8000-000000000004",
    ticketIndex: 2,
    performerIndex: 0,
    assigneeIndex: null,
    actionAt: "2026-10-27T05:00:00.000Z",
    description: "Prepare a replacement network adapter for testing.",
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: "Requester reported no related file.",
    targetStatus: "CANCELLED" as const,
    result: null,
  },
] as const;

type SeedClient = Pick<PrismaClient,
  "category" | "relatedSystem" | "user" | "ticket" | "publicComment" | "internalNote"
  | "actionTaken" | "actionEvent" | "ticketStatusEvent"
>;

type SeedActionFixture = (typeof actionFixtures)[number] | typeof recentResolvedActionFixture;

const actionableTicketStatuses: readonly TicketStatus[] = [
  "NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED",
];

function snapshotForAction(
  fixture: SeedActionFixture,
  status: ActionStatus,
  version: number,
  performedBy: { id: number; name: string },
  assignee: { id: number; name: string } | null,
  result: string | null,
) {
  return {
    actionAt: new Date(fixture.actionAt).toISOString(),
    description: fixture.description,
    result,
    performedBy: { ...performedBy, role: "IT_STAFF" },
    assignee: assignee ? { ...assignee, role: "IT_STAFF" } : null,
    status,
    followUpRequired: fixture.followUpRequired,
    followUpNote: fixture.followUpNote,
    attachmentNotes: fixture.attachmentNotes,
    version,
  };
}

async function nextTicketActivityTime(prisma: SeedClient, ticketId: number) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { updatedAt: true } });
  return new Date(Math.max(Date.now(), ticket.updatedAt.getTime() + 1));
}

async function advanceTicketWorkflow(prisma: SeedClient, ticketId: number) {
  const updatedAt = await nextTicketActivityTime(prisma, ticketId);
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { workflowVersion: { increment: 1 }, updatedAt },
  });
}

async function createSeedAction(
  prisma: SeedClient,
  ticketId: number,
  fixture: SeedActionFixture,
  performer: { id: number; name: string },
  assignee: { id: number; name: string } | null,
) {
  const actionAt = new Date(fixture.actionAt);
  const fingerprint = createHash("sha256").update(JSON.stringify({
    ticketId,
    actionAt: actionAt.toISOString(),
    description: fixture.description,
    result: null,
    performedById: performer.id,
    assigneeId: assignee?.id ?? null,
    followUpRequired: fixture.followUpRequired,
    followUpNote: fixture.followUpNote,
    attachmentNotes: fixture.attachmentNotes,
  })).digest("hex");
  const action = await prisma.actionTaken.create({
    data: {
      ticketId,
      actionAt,
      description: fixture.description,
      result: null,
      performedById: performer.id,
      assigneeId: assignee?.id ?? null,
      status: "PLANNED",
      followUpRequired: fixture.followUpRequired,
      followUpNote: fixture.followUpNote,
      attachmentNotes: fixture.attachmentNotes,
      version: 1,
      idempotencyKey: fixture.key,
      creationFingerprint: fingerprint,
    },
  });
  const plannedSnapshot = snapshotForAction(fixture, "PLANNED", 1, performer, assignee, null);
  await prisma.actionEvent.create({
    data: { actionId: action.id, actorId: performer.id, type: "CREATED", after: plannedSnapshot },
  });
  await advanceTicketWorkflow(prisma, ticketId);

  if (fixture.targetStatus !== "PLANNED") {
    const finalResult = fixture.targetStatus === "COMPLETED" ? fixture.result : null;
    const finalSnapshot = snapshotForAction(fixture, fixture.targetStatus, 2, performer, assignee, finalResult);
    await prisma.actionTaken.update({
      where: { id: action.id },
      data: { status: fixture.targetStatus, result: finalResult, version: 2 },
    });
    await prisma.actionEvent.create({
      data: { actionId: action.id, actorId: performer.id, type: "STATUS_CHANGED", before: plannedSnapshot, after: finalSnapshot },
    });
    await advanceTicketWorkflow(prisma, ticketId);
  }
}

export async function seedDatabase(prisma: SeedClient) {
  for (const name of categories) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const name of relatedSystems) {
    await prisma.relatedSystem.upsert({ where: { name }, update: {}, create: { name } });
  }
  const seedUsers = [
    ...requesters.map((requester) => ({ ...requester, role: "REQUESTER" as const })),
    ...staffUsers,
    ...lab4DashboardUsers,
  ];
  for (const user of seedUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, role: user.role as UserRole, passwordHash: await argon2.hash(initialPassword, hashOptions), mustChangePassword: true },
    });
  }

  const usersWithoutPasswords = await prisma.user.findMany({
    where: { email: { in: seedUsers.map(({ email }) => email) }, passwordHash: null },
    select: { id: true },
  });
  for (const user of usersWithoutPasswords) {
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await argon2.hash(initialPassword, hashOptions), mustChangePassword: true } });
  }

  const [requesterRows, ownerRows, categoryRows, systemRows] = await Promise.all([
    prisma.user.findMany({ where: { email: { in: requesters.filter(({ isActive }) => isActive).map(({ email }) => email) } }, orderBy: { email: "asc" }, select: { id: true, email: true } }),
    prisma.user.findMany({ where: { email: { in: staffUsers.filter(({ isActive, role }) => isActive && role === "IT_STAFF").map(({ email }) => email) } }, orderBy: { email: "asc" }, select: { id: true, email: true, name: true } }),
    prisma.category.findMany({ where: { name: { in: [...categories] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.relatedSystem.findMany({ where: { name: { in: [...relatedSystems] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (requesterRows.length !== 4 || ownerRows.length !== 3 || categoryRows.length !== 4 || systemRows.length !== 6) throw new Error("Lab 3 seed prerequisites are incomplete.");

  const requestersByEmail = new Map(requesterRows.map((row) => [row.email, row]));
  const ownersByEmail = new Map(ownerRows.map((row) => [row.email, row]));
  const categoriesByName = new Map(categoryRows.map((row) => [row.name, row]));
  const systemsByName = new Map(systemRows.map((row) => [row.name, row]));
  const requesterIndex = (index: number) => requestersByEmail.get(requesters.filter(({ isActive }) => isActive)[index].email)!.id;
  const ownerIndex = (index: number) => ownersByEmail.get(staffUsers.filter(({ isActive, role }) => isActive && role === "IT_STAFF")[index].email)!;

  for (const fixture of ticketFixtures) {
    await prisma.ticket.upsert({
      where: { ticketNumber: fixture.ticketNumber }, update: {},
      create: {
        ticketNumber: fixture.ticketNumber, summary: fixture.summary, description: fixture.description,
        requesterId: requesterIndex(fixture.requesterIndex), ownerId: fixture.ownerIndex === null ? null : ownerIndex(fixture.ownerIndex).id,
        categoryId: categoriesByName.get(categories[fixture.categoryIndex])!.id,
        relatedSystemId: systemsByName.get(relatedSystems[fixture.relatedSystemIndex])!.id,
        requestedPriority: fixture.requestedPriority, itPriority: fixture.itPriority, status: fixture.status,
        resolutionIndicatedAt: fixture.status === "WAITING_FOR_REQUESTER" ? new Date("2026-09-01T00:00:00.000Z") : null,
      },
    });
  }

  const recentResolvedTicket = await prisma.ticket.findUnique({
    where: { ticketNumber: recentResolvedTicketFixture.ticketNumber },
    select: { id: true },
  });
  if (!recentResolvedTicket) {
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: recentResolvedTicketFixture.ticketNumber,
        summary: recentResolvedTicketFixture.summary,
        description: recentResolvedTicketFixture.description,
        requesterId: requesterIndex(recentResolvedTicketFixture.requesterIndex),
        ownerId: ownerIndex(recentResolvedTicketFixture.ownerIndex).id,
        categoryId: categoriesByName.get(categories[recentResolvedTicketFixture.categoryIndex])!.id,
        relatedSystemId: systemsByName.get(relatedSystems[recentResolvedTicketFixture.relatedSystemIndex])!.id,
        requestedPriority: recentResolvedTicketFixture.requestedPriority,
        itPriority: recentResolvedTicketFixture.itPriority,
        status: "OPEN",
      },
    });
    await createSeedAction(
      prisma,
      ticket.id,
      recentResolvedActionFixture,
      ownerIndex(recentResolvedActionFixture.performerIndex),
      null,
    );
    const changedAt = await nextTicketActivityTime(prisma, ticket.id);
    await prisma.ticketStatusEvent.create({
      data: { ticketId: ticket.id, fromStatus: "OPEN", toStatus: "RESOLVED", actorId: ownerIndex(0).id, changedAt },
    });
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "RESOLVED", workflowVersion: { increment: 1 }, updatedAt: changedAt },
    });
  }

  let fallbackTicket: { id: number; status: TicketStatus } | null = null;
  for (const fixture of actionFixtures) {
    const existing = await prisma.actionTaken.findUnique({ where: { idempotencyKey: fixture.key } });
    if (existing) continue;

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { ticketNumber: ticketFixtures[fixture.ticketIndex].ticketNumber },
      select: { id: true, status: true },
    });
    let actionTicket = ticket;
    if (!actionableTicketStatuses.includes(ticket.status)) {
      fallbackTicket ??= await prisma.ticket.upsert({
        where: { ticketNumber: actionFallbackTicketFixture.ticketNumber },
        update: {},
        create: {
          ticketNumber: actionFallbackTicketFixture.ticketNumber,
          summary: actionFallbackTicketFixture.summary,
          description: actionFallbackTicketFixture.description,
          requesterId: requesterIndex(actionFallbackTicketFixture.requesterIndex),
          ownerId: ownerIndex(actionFallbackTicketFixture.ownerIndex).id,
          categoryId: categoriesByName.get(categories[actionFallbackTicketFixture.categoryIndex])!.id,
          relatedSystemId: systemsByName.get(relatedSystems[actionFallbackTicketFixture.relatedSystemIndex])!.id,
          requestedPriority: actionFallbackTicketFixture.requestedPriority,
          itPriority: actionFallbackTicketFixture.itPriority,
          status: "OPEN",
        },
        select: { id: true, status: true },
      });
      actionTicket = fallbackTicket;
    }

    if (!actionableTicketStatuses.includes(actionTicket.status)) continue;

    const performer = ownerIndex(fixture.performerIndex);
    const assignee = fixture.assigneeIndex === null ? null : ownerIndex(fixture.assigneeIndex);
    await createSeedAction(prisma, actionTicket.id, fixture, performer, assignee);
  }

  const firstTicket = await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber: ticketFixtures[0].ticketNumber }, select: { id: true } });
  const requesterAuthor = requesterRows[0].id;
  const staffAuthor = ownerRows[0].id;
  if (!await prisma.publicComment.findFirst({ where: { ticketId: firstTicket.id } })) {
    await prisma.publicComment.create({ data: { ticketId: firstTicket.id, authorId: requesterAuthor, content: "The problem still occurs after restarting." } });
  }
  if (!await prisma.internalNote.findFirst({ where: { ticketId: firstTicket.id } })) {
    await prisma.internalNote.create({ data: { ticketId: firstTicket.id, authorId: staffAuthor, content: "Check the account and network logs during follow-up." } });
  }
}
