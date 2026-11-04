import { execSync } from "node:child_process";
import { assertDisposable, TEST_DATABASE_URL } from "./test-db";

// Runs once before the integration project: resets the disposable database
// to the current Prisma schema. Does nothing when TEST_DATABASE_URL is unset
// (the integration tests skip themselves in that case).
export default function setup() {
  if (!TEST_DATABASE_URL) return;
  assertDisposable(TEST_DATABASE_URL);

  execSync("npx prisma db push --force-reset --skip-generate", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_URL: TEST_DATABASE_URL,
    },
  });
}
