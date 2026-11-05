import type { Actor } from "@/lib/domain/actor";

export { owner, member, agent } from "./actors";

/**
 * Creates a board with To do, Doing and Done lists in the actor's workspace
 * and returns it with its lists by key.
 */
export async function seedBoard(actor: Actor, title = "Board") {
  const { db } = await import("@/lib/db");
  const board = await db.board.create({
    data: {
      orgId: actor.orgId,
      title,
      imageId: "img",
      imageThumbUrl: "thumb",
      imageFullUrl: "full",
      imageUserName: "user",
      imageLinkHTML: "link",
    },
  });
  const [todo, doing, done] = await Promise.all(
    ["To do", "Doing", "Done"].map((listTitle, index) =>
      db.list.create({
        data: { boardId: board.id, title: listTitle, order: index + 1 },
      }),
    ),
  );
  return { board, lists: { todo, doing, done } };
}

/** Creates an agent token through the owner and resolves it to an actor. */
export async function seedAgent(
  ownerActor: Actor,
  roleKey: string,
  agentName = `${roleKey} agent`,
) {
  const { createAgentToken, resolveAgentToken } = await import(
    "@/lib/domain/tokens"
  );
  const { token, secret } = await createAgentToken(ownerActor, {
    agentName,
    roleKey,
  });
  const actor = await resolveAgentToken(secret);
  if (!actor) throw new Error("token did not resolve");
  return { token, secret, actor };
}

/** An MCP client talking to the real route handler in-process. */
export async function mcpClient(secret: string) {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StreamableHTTPClientTransport } = await import(
    "@modelcontextprotocol/sdk/client/streamableHttp.js"
  );
  const route = await import("@/app/api/mcp/route");
  const handlers: Record<string, (req: Request) => Promise<Response>> = {
    POST: route.POST,
    GET: route.GET,
    DELETE: route.DELETE,
  };

  const transport = new StreamableHTTPClientTransport(
    new URL("http://localhost/api/mcp"),
    {
      requestInit: { headers: { Authorization: `Bearer ${secret}` } },
      fetch: async (url, init) => {
        const req = new Request(url, init);
        return handlers[req.method](req);
      },
    },
  );
  const client = new Client({ name: "test-agent", version: "1.0.0" });
  await client.connect(transport);

  /** Calls a tool and returns its parsed JSON body and error flag. */
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    const content = result.content as { type: string; text: string }[];
    const text = content[0]?.text ?? "null";
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: { type: "invalid", message: text } };
    }
    return { isError: Boolean(result.isError), body: body as any };
  };

  return { client, call, close: () => client.close() };
}
