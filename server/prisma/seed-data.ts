import type { PrismaClient } from "@prisma/client";

export const categories = ["Account and Access", "Hardware", "Software", "Network"] as const;
export const relatedSystems = ["Email", "Campus Wi-Fi", "VPN", "LEB2 App", "Grade Submission App", "Printer"] as const;
export const requesters = [
  { name: "Nicha Somchai", email: "nicha.somchai@toktickit.test", isActive: true },
  { name: "Anan Kittisak", email: "anan.kittisak@toktickit.test", isActive: true },
  { name: "Mali Charoen", email: "mali.charoen@toktickit.test", isActive: true },
  { name: "Preecha Wattanakul", email: "preecha.wattanakul@toktickit.test", isActive: true },
  { name: "Suda Inactive", email: "suda.inactive@toktickit.test", isActive: false },
] as const;

export async function seedDatabase(prisma: Pick<PrismaClient, "category" | "relatedSystem" | "requester">) {
  for (const name of categories) {
    await prisma.category.upsert({ where: { name }, update: { isActive: true }, create: { name } });
  }
  for (const name of relatedSystems) {
    await prisma.relatedSystem.upsert({ where: { name }, update: { isActive: true }, create: { name } });
  }
  for (const requester of requesters) {
    await prisma.requester.upsert({ where: { email: requester.email }, update: { name: requester.name, isActive: requester.isActive }, create: requester });
  }
}
