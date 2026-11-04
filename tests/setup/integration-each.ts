import { afterAll, beforeEach } from "vitest";
import { TEST_DATABASE_URL } from "./test-db";

// Point the app's Prisma client (lib/db.ts) at the test database before any
// test file imports it.
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.DIRECT_URL = TEST_DATABASE_URL;

  const { db } = await import("@/lib/db");

  // Per-test isolation: empty every table before each test.
  beforeEach(async () => {
    const tables = await db.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    if (tables.length === 0) return;
    const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
    await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  });

  afterAll(async () => {
    await db.$disconnect();
  });
}
