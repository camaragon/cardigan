import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Two projects:
// - unit: pure tests, no database, run in parallel.
// - integration: real Postgres via TEST_DATABASE_URL, run serially with the
//   database truncated before every test. Skipped when the env var is unset.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/setup/integration-global.ts"],
          setupFiles: ["tests/setup/integration-each.ts"],
          // One process, one file at a time: files share the database.
          pool: "forks",
          poolOptions: { forks: { singleFork: true } },
          // Run after the unit project so its single worker is not contended.
          sequence: { groupOrder: 1 },
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
