import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { recordFailedCall } from "@/lib/domain/audit";
import { resolveAgentToken } from "@/lib/domain/tokens";
import { CallContext, createMcpServer } from "@/lib/mcp/server";

/**
 * The MCP endpoint (ADR 0001). Off unless MCP_ENABLED=true: ADR 0002 keeps it
 * unreachable until the app is served only on a private network. It skips
 * Clerk session protection and accepts only a valid agent token.
 */
const isEnabled = () => process.env.MCP_ENABLED === "true";

const json = (status: number, body: unknown) =>
  Response.json(body, { status });

const bearer = (req: Request) => {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? null;
};

const toolCallName = (message: unknown): string | null => {
  if (!message || typeof message !== "object") return null;
  const m = message as { method?: string; params?: { name?: unknown } };
  return m.method === "tools/call" && typeof m.params?.name === "string"
    ? m.params.name
    : null;
};

const handle = async (req: Request) => {
  if (!isEnabled()) return new Response(null, { status: 404 });

  const secret = bearer(req);
  // An invalid or revoked token never reaches a workspace and writes no entry.
  const actor = secret ? await resolveAgentToken(secret) : null;
  if (!actor) {
    return json(401, {
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized: a valid agent token is required" },
      id: null,
    });
  }

  const message = await req.clone().json().catch(() => null);
  const tool = toolCallName(message);

  const context: CallContext = { failureRecorded: false };
  const server = createMcpServer(actor, context);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);

  try {
    const response = await transport.handleRequest(req);
    // Calls refused before a tool handler ran (unknown tool, invalid
    // arguments) are failed calls too (PRD C-5).
    if (tool && !context.failureRecorded) {
      const body = await response.clone().json().catch(() => null);
      if (body?.error || body?.result?.isError) {
        await recordFailedCall(actor, tool, "invalid");
      }
    }
    return response;
  } finally {
    await server.close();
  }
};

// Stateless: there are no sessions to stream (GET) or end (DELETE), so only
// POST is exported and Next.js answers other methods with 405.
export const POST = handle;
