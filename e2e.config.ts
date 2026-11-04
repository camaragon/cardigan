import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";
import { gateway } from "ai";

// End-to-end journeys (e2e/**/*.e2e.ts). See e2e/README.md for the
// environment variables they need. Without them every journey is skipped.
//
// Agent steps use the model named by E2E_MODEL through the AI SDK gateway
// (key in AI_GATEWAY_API_KEY). Deterministic steps need no model.
const model = process.env.E2E_MODEL;

export default {
  tests: "e2e/**/*.e2e.ts",
  targets: [
    {
      name: "web",
      engine: web(),
      app: {
        url: process.env.APP_URL ?? "http://localhost:3000",
        command: {
          executable: "npm",
          args: ["run", "dev"],
          reuseExisting: true,
          startupTimeout: 120_000,
          log: ".e2e/logs/app.log",
        },
      },
    },
  ],
  ...(model ? { agents: { default: { model: gateway(model) } } } : {}),
} satisfies E2EConfig;
