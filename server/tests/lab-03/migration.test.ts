import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";

const readMigration = (name: string) => readFileSync(new URL(`../../prisma/migrations/${name}/migration.sql`, import.meta.url), "utf8");
const initMigration = readMigration("20260809101008_init");
const lab2Migration = readMigration("20260825000000_lab2_ticketing");
const lab3Migration = readMigration("20260918000000_lab3_data_foundation");
const admin = getPrisma();

async function executeSql(prisma: PrismaClient, sql: string) {
  const blocks: string[] = [];
  const protectedSql = sql.replace(/DO \$\$[\s\S]*?\$\$;/g, (block) => {
    blocks.push(block);
    return `__DOLLAR_BLOCK_${blocks.length - 1}__;`;
  });
  for (const part of protectedSql.split(";")) {
    const statement = part.trim();
    if (!statement) continue;
    const match = statement.match(/__DOLLAR_BLOCK_(\d+)__/);
    await prisma.$executeRawUnsafe(match ? blocks[Number(match[1])] : statement);
  }
}

async function withIsolatedSchema(run: (prisma: PrismaClient) => Promise<void>) {
  const schema = `lab3_migration_${randomUUID().replaceAll("-", "")}`;
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set("schema", schema);
  const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  try {
    await run(prisma);
  } finally {
    await prisma.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  }
}

describe("Lab 3 preservation migration", () => {
  afterAll(() => admin.$disconnect());

  it("preserves populated Lab 2 identities, relationships, timestamps, and files", async () => {
    expect(lab3Migration).toContain('ALTER TABLE "Requester" RENAME TO "User"');
    expect(lab3Migration).not.toMatch(/DROP TABLE\s+"Requester"/i);

    await withIsolatedSchema(async (prisma) => {
      await executeSql(prisma, initMigration);
      await executeSql(prisma, lab2Migration);
      await executeSql(prisma, `
        INSERT INTO "Category" (id, name, "isActive", "createdAt") VALUES (11, 'Hardware', true, '2026-01-01T00:00:00Z');
        INSERT INTO "Requester" (id, name, email, "isActive", "createdAt", "updatedAt") VALUES (21, 'Legacy User', 'legacy.user@toktickit.test', true, '2026-01-02T00:00:00Z', '2026-01-03T00:00:00Z');
        INSERT INTO "RelatedSystem" (id, name, "isActive", "createdAt") VALUES (31, 'Laptop', true, '2026-01-01T00:00:00Z');
        INSERT INTO "Ticket" (id, "ticketNumber", "requesterId", "categoryId", "relatedSystemId", "requestedPriority", status, summary, description, "createdAt", "updatedAt")
          VALUES (41, 'TKT-2026-LEGACY01', 21, 11, 31, 'HIGH', 'NEW', 'Legacy ticket', 'Preserve this populated ticket.', '2026-01-04T00:00:00Z', '2026-01-05T00:00:00Z');
        INSERT INTO "Attachment" (id, "ticketId", "originalName", "storageKey", "mimeType", "sizeBytes", "createdAt")
          VALUES (51, 41, 'evidence.pdf', 'legacy-storage-key', 'application/pdf', 1234, '2026-01-06T00:00:00Z');
      `);
      await executeSql(prisma, lab3Migration);

      const [users, tickets, attachments] = await Promise.all([
        prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT id, email, role, "createdAt", "updatedAt" FROM "User"`),
        prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT id, "requesterId", "requestedPriority", "itPriority", "createdAt", "updatedAt" FROM "Ticket"`),
        prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT id, "ticketId", "storageKey", "createdAt" FROM "Attachment"`),
      ]);
      expect(users[0]).toMatchObject({ id: 21, email: "legacy.user@toktickit.test", role: "REQUESTER" });
      expect(tickets[0]).toMatchObject({ id: 41, requesterId: 21, requestedPriority: "HIGH", itPriority: "HIGH" });
      expect(attachments[0]).toMatchObject({ id: 51, ticketId: 41, storageKey: "legacy-storage-key" });
      expect(users[0].createdAt).toEqual(new Date("2026-01-02T00:00:00.000Z"));
      expect(tickets[0].updatedAt).toEqual(new Date("2026-01-05T00:00:00.000Z"));
      expect(attachments[0].createdAt).toEqual(new Date("2026-01-06T00:00:00.000Z"));
    });
  });

  it("rejects normalized-email collisions before rewriting addresses", async () => {
    await withIsolatedSchema(async (prisma) => {
      await executeSql(prisma, initMigration);
      await executeSql(prisma, lab2Migration);
      await executeSql(prisma, `
        INSERT INTO "Requester" (name, email, "isActive", "createdAt", "updatedAt") VALUES
          ('First', 'duplicate@toktickit.test', true, now(), now()),
          ('Second', ' DUPLICATE@toktickit.test ', true, now(), now());
      `);
      await expect(executeSql(prisma, lab3Migration)).rejects.toThrow(/duplicates would result/);
      const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name IN ('Requester', 'User') ORDER BY table_name`,
      );
      expect(tables).toEqual([{ table_name: "Requester" }]);
    });
  });
});
