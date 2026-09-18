import type { PrismaClient, RequestedPriority, TicketStatus, UserRole } from "@prisma/client";
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

type SeedClient = Pick<PrismaClient, "category" | "relatedSystem" | "user" | "ticket" | "publicComment" | "internalNote">;

export async function seedDatabase(prisma: SeedClient) {
  for (const name of categories) {
    await prisma.category.upsert({ where: { name }, update: { isActive: true }, create: { name } });
  }
  for (const name of relatedSystems) {
    await prisma.relatedSystem.upsert({ where: { name }, update: { isActive: true }, create: { name } });
  }
  for (const user of [...requesters.map((requester) => ({ ...requester, role: "REQUESTER" as const })), ...staffUsers]) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, role: user.role as UserRole, passwordHash: await argon2.hash(initialPassword, hashOptions), mustChangePassword: true },
    });
  }

  const usersWithoutPasswords = await prisma.user.findMany({ where: { passwordHash: null }, select: { id: true } });
  for (const user of usersWithoutPasswords) {
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await argon2.hash(initialPassword, hashOptions), mustChangePassword: true } });
  }

  const [requesterRows, ownerRows, categoryRows, systemRows] = await Promise.all([
    prisma.user.findMany({ where: { email: { in: requesters.filter(({ isActive }) => isActive).map(({ email }) => email) } }, orderBy: { email: "asc" }, select: { id: true } }),
    prisma.user.findMany({ where: { email: { in: staffUsers.filter(({ isActive, role }) => isActive && role === "IT_STAFF").map(({ email }) => email) } }, orderBy: { email: "asc" }, select: { id: true } }),
    prisma.category.findMany({ where: { name: { in: [...categories] } }, orderBy: { name: "asc" }, select: { id: true } }),
    prisma.relatedSystem.findMany({ where: { name: { in: [...relatedSystems] } }, orderBy: { name: "asc" }, select: { id: true } }),
  ]);
  if (requesterRows.length !== 4 || ownerRows.length !== 3 || categoryRows.length !== 4 || systemRows.length !== 6) throw new Error("Lab 3 seed prerequisites are incomplete.");

  for (const fixture of ticketFixtures) {
    await prisma.ticket.upsert({
      where: { ticketNumber: fixture.ticketNumber }, update: {},
      create: {
        ticketNumber: fixture.ticketNumber, summary: fixture.summary, description: fixture.description,
        requesterId: requesterRows[fixture.requesterIndex].id, ownerId: fixture.ownerIndex === null ? null : ownerRows[fixture.ownerIndex].id,
        categoryId: categoryRows[fixture.categoryIndex].id, relatedSystemId: systemRows[fixture.relatedSystemIndex].id,
        requestedPriority: fixture.requestedPriority, itPriority: fixture.itPriority, status: fixture.status,
        problemAppearsResolvedAt: fixture.status === "WAITING_FOR_REQUESTER" ? new Date("2026-09-01T00:00:00.000Z") : null,
      },
    });
  }

  const firstTicket = await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber: ticketFixtures[0].ticketNumber }, select: { id: true } });
  const requesterAuthor = requesterRows[0].id;
  const staffAuthor = ownerRows[0].id;
  if (!await prisma.publicComment.findFirst({ where: { ticketId: firstTicket.id, authorId: requesterAuthor, content: "The problem still occurs after restarting." } })) {
    await prisma.publicComment.create({ data: { ticketId: firstTicket.id, authorId: requesterAuthor, content: "The problem still occurs after restarting." } });
  }
  if (!await prisma.internalNote.findFirst({ where: { ticketId: firstTicket.id, authorId: staffAuthor, content: "Check the account and network logs during follow-up." } })) {
    await prisma.internalNote.create({ data: { ticketId: firstTicket.id, authorId: staffAuthor, content: "Check the account and network logs during follow-up." } });
  }
}
