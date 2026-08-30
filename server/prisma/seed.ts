import { getPrisma } from "../src/prisma.js";
import { seedDatabase } from "./seed-data.js";

async function main() {
  await seedDatabase(getPrisma());
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
