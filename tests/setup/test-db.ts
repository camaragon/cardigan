/**
 * Integration tests run against a disposable Postgres database named by
 * TEST_DATABASE_URL. The schema is pushed with `prisma db push --force-reset`,
 * so this must never point at a database you care about. As a guard, the
 * database name must contain "test".
 */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

export const hasTestDatabase = Boolean(TEST_DATABASE_URL);

export function assertDisposable(url: string) {
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!/test/i.test(name)) {
    throw new Error(
      `Refusing to use database "${name}" for tests: the name must contain "test".`,
    );
  }
}
