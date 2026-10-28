import { getPrisma } from "../src/prisma.js";
import { seedDatabase } from "./seed-data.js";

async function main() {
  const prisma = getPrisma();
  await prisma.$transaction((transaction) => seedDatabase(transaction), { timeout: 60_000 });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
