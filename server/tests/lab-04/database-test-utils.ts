import { Prisma, PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

export function validateTestDatabaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }
  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!(["postgres:", "postgresql:"].includes(url.protocol)) || !databaseName.endsWith("_test")) {
    throw new Error("Lab 4 database tests require TEST_DATABASE_URL to target a PostgreSQL database whose name ends in _test.");
  }
  return url.toString();
}

export const testDatabaseEnabled = Boolean(process.env.TEST_DATABASE_URL);

function requireTestDatabaseUrl(): string {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error("Set TEST_DATABASE_URL to a disposable PostgreSQL database ending in _test to run Lab 4 database tests.");
  }
  return validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);
}

type SqlExecutor = Pick<Prisma.TransactionClient, "$executeRawUnsafe">;

export async function executeSql(client: SqlExecutor, sql: string): Promise<void> {
  const blocks: string[] = [];
  const protectedSql = sql
    .replace(/^\s*BEGIN;\s*/i, "")
    .replace(/\s*COMMIT;\s*$/i, "")
    .replace(/(?:DO|CREATE FUNCTION)[\s\S]*?\$\$;/gi, (block) => {
      blocks.push(block);
      return `__DOLLAR_BLOCK_${blocks.length - 1}__;`;
    });

  for (const part of protectedSql.split(";")) {
    const statement = part.trim();
    if (!statement) continue;
    const match = statement.match(/__DOLLAR_BLOCK_(\d+)__/);
    await client.$executeRawUnsafe(match ? blocks[Number(match[1])] : statement);
  }
}

export async function executeSqlTransaction(prisma: PrismaClient, sql: string): Promise<void> {
  await prisma.$transaction((transaction) => executeSql(transaction, sql), { timeout: 60_000 });
}

export function readMigration(name: string): string {
  return readFileSync(new URL(`../../prisma/migrations/${name}/migration.sql`, import.meta.url), "utf8");
}

export async function applyMigration(prisma: PrismaClient, name: string): Promise<void> {
  await executeSqlTransaction(prisma, readMigration(name));
}

export async function applyLab3Baseline(prisma: PrismaClient, storageKey = "legacy-upload.bin"): Promise<void> {
  if (!/^[a-z0-9-]+\.bin$/i.test(storageKey)) throw new Error("Migration test storage keys must be simple generated file names.");
  await applyMigration(prisma, "20260809101008_init");
  await applyMigration(prisma, "20260825000000_lab2_ticketing");
  await executeSqlTransaction(prisma, `
    INSERT INTO "Category" (id, name, "isActive", "createdAt")
      VALUES (11, 'Legacy Hardware', false, '2026-01-01T00:00:00Z');
    INSERT INTO "Requester" (id, name, email, "isActive", "createdAt", "updatedAt")
      VALUES (21, 'Legacy Requester', 'legacy.requester@toktickit.test', true, '2026-01-02T00:00:00Z', '2026-01-03T00:00:00Z');
    INSERT INTO "RelatedSystem" (id, name, "isActive", "createdAt")
      VALUES (31, 'Legacy VPN', false, '2026-01-01T00:00:00Z');
    INSERT INTO "Ticket" (id, "ticketNumber", "requesterId", "categoryId", "relatedSystemId", "requestedPriority", status, summary, description, "createdAt", "updatedAt")
      VALUES (41, 'TKT-2026-LEGACY01', 21, 11, 31, 'HIGH', 'NEW', 'Legacy ticket', 'Preserve populated Lab 3 data.', '2026-01-04T00:00:00Z', '2026-01-05T00:00:00Z');
    INSERT INTO "Attachment" (id, "ticketId", "originalName", "storageKey", "mimeType", "sizeBytes", "createdAt")
      VALUES (51, 41, 'evidence.pdf', '${storageKey}', 'application/octet-stream', 18, '2026-01-06T00:00:00Z');
  `);
  await applyMigration(prisma, "20260918000000_lab3_data_foundation");
  await executeSqlTransaction(prisma, `
    INSERT INTO "User" (id, name, email, role, "isActive", "mustChangePassword", "createdAt", "updatedAt")
      VALUES (22, 'Legacy Staff', 'legacy.staff@toktickit.test', 'IT_STAFF', true, true, '2026-01-02T00:00:00Z', '2026-01-03T00:00:00Z');
    UPDATE "Ticket" SET "ownerId" = 22 WHERE id = 41;
    INSERT INTO "PublicComment" (id, "ticketId", "authorId", content, "createdAt")
      VALUES (61, 41, 21, 'Legacy public comment', '2026-01-07T00:00:00Z');
    INSERT INTO "InternalNote" (id, "ticketId", "authorId", content, "createdAt")
      VALUES (71, 41, 22, 'Legacy internal note', '2026-01-08T00:00:00Z');
  `);
  for (const [table, id] of [["User", 22], ["Ticket", 41], ["Attachment", 51], ["PublicComment", 61], ["InternalNote", 71]] as const) {
    await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id')::regclass, ${id}, true)`);
  }
}

export async function withIsolatedSchema<T>(run: (prisma: PrismaClient) => Promise<T>): Promise<T> {
  const testUrl = requireTestDatabaseUrl();
  const schema = `lab4_test_${randomUUID().replaceAll("-", "")}`;
  const adminUrl = new URL(testUrl);
  adminUrl.searchParams.set("schema", "public");
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  let schemaCreated = false;

  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    const isolatedUrl = new URL(testUrl);
    isolatedUrl.searchParams.set("schema", schema);
    const prisma = new PrismaClient({ datasources: { db: { url: isolatedUrl.toString() } } });
    try {
      return await run(prisma);
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    if (schemaCreated) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.$disconnect();
  }
}
