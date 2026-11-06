import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { AddComment } from "@/actions/add-comment/schema";
import { CreateCard } from "@/actions/create-card/schema";
import { MoveCard } from "@/actions/move-card/schema";
import { UpdateCard } from "@/actions/update-card/schema";
import { Actor } from "@/lib/domain/actor";
import { recordFailedCall } from "@/lib/domain/audit";
import { describeWorkspace } from "@/lib/domain/boards";
import {
  compactCard,
  createCards,
  getCard,
  listCards,
  moveCard,
  searchCards,
  updateCard,
} from "@/lib/domain/cards";
import { getChanges } from "@/lib/domain/changes";
import { addComment, markDuplicate } from "@/lib/domain/comments";
import { isDomainError } from "@/lib/domain/errors";
import {
  FRICTION_CATEGORIES,
  FRICTION_COMPONENTS,
  FRICTION_IMPACTS,
  reportFriction,
} from "@/lib/domain/friction";
import { LIMITS } from "@/lib/domain/limits";

const INSTRUCTIONS = `Cardigan task board. Start with describe_workspace: it returns your role, \
your capabilities, every board with its lists, and the labels. A denial names the rule, who \
may act, and what you can do instead. Poll get_changes with the last nextCursor instead of re-listing \
boards. Creates and comments take an externalKey so retries are safe. Agents cannot delete \
anything or change settings.`;

/** Every tool the server registers; friction reports name one of them. */
export const TOOL_NAMES = [
  "describe_workspace",
  "list_cards",
  "search_cards",
  "get_card",
  "create_cards",
  "update_card",
  "move_card",
  "add_comment",
  "mark_duplicate",
  "get_changes",
  "report_friction",
] as const;
type ToolName = (typeof TOOL_NAMES)[number];

// Text rules come from the server actions' schemas, so people and agents
// follow the same ones.
const id = z.string().min(1).max(100);
const externalKey = z.string().min(1).max(LIMITS.externalKey);
const { title, description } = UpdateCard.shape;
const { body } = AddComment.shape;

/** Tracks whether a tool handler already recorded its own failure. */
export interface CallContext {
  failureRecorded: boolean;
}

/**
 * Builds the MCP server for one agent actor. Every tool calls the same
 * domain functions as the UI; failures are recorded as attributed entries.
 */
export const createMcpServer = (actor: Actor, context: CallContext) => {
  const server = new McpServer(
    { name: "cardigan", version: "0.1.0" },
    { instructions: INSTRUCTIONS },
  );

  const run =
    <A>(tool: ToolName, fn: (args: A) => Promise<unknown>) =>
    async (args: A): Promise<CallToolResult> => {
      try {
        const result = await fn(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error) {
        const body = isDomainError(error)
          ? error.toJSON()
          : { type: "internal", message: "Internal error" };
        if (!isDomainError(error)) console.error("[MCP_TOOL_ERROR]", error);
        await recordFailedCall(actor, tool, body.type);
        context.failureRecorded = true;
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ error: body }) }],
        };
      }
    };

  server.registerTool(
    "describe_workspace",
    {
      description:
        "Your role and capabilities, the workspace's boards with their lists, and its labels.",
      inputSchema: {},
    },
    run("describe_workspace", () => describeWorkspace(actor)),
  );

  server.registerTool(
    "list_cards",
    {
      description:
        "Compact cards of one board or one list, in board order (list order, then position). Use a list id to read a queue in priority order. Paged by cursor.",
      inputSchema: {
        boardId: id.optional(),
        listId: id.optional(),
        limit: z.number().int().min(1).max(LIMITS.page).optional(),
        cursor: z.string().max(20).optional(),
      },
    },
    run("list_cards", (args: { boardId?: string; listId?: string; limit?: number; cursor?: string }) =>
      listCards(actor, args),
    ),
  );

  server.registerTool(
    "search_cards",
    {
      description:
        "Search card titles, descriptions and comments in your workspace. Returns compact cards.",
      inputSchema: {
        query: z.string().trim().min(1).max(LIMITS.query),
        boardId: id.optional(),
        limit: z.number().int().min(1).max(LIMITS.page).optional(),
      },
    },
    run("search_cards", (args: { query: string; boardId?: string; limit?: number }) =>
      searchCards(actor, args),
    ),
  );

  server.registerTool(
    "get_card",
    {
      description:
        "Everything about one card: description, labels, comments, provenance, version and a page of activity.",
      inputSchema: {
        cardId: id,
        activityLimit: z.number().int().min(1).max(LIMITS.page).optional(),
        activityBefore: z.number().int().min(1).optional(),
      },
    },
    run("get_card", (args: { cardId: string; activityLimit?: number; activityBefore?: number }) =>
      getCard(actor, args.cardId, args),
    ),
  );

  server.registerTool(
    "create_cards",
    {
      description: `Create up to ${LIMITS.batch} cards, each with its own externalKey. Returns one result per item in input order; a failed item does not stop the others. Retrying with the same keys and payloads creates nothing new.`,
      inputSchema: {
        cards: z
          .array(
            CreateCard.omit({ boardId: true }).extend({ description, externalKey }),
          )
          .min(1)
          .max(LIMITS.batch),
      },
    },
    run("create_cards", async (args: { cards: { listId: string; title: string; description?: string; externalKey: string }[] }) => ({
      results: await createCards(actor, args.cards),
    })),
  );

  server.registerTool(
    "update_card",
    {
      description:
        "Update a card's title or description. Pass the version you read; a stale version is refused with the current card and its last actor.",
      inputSchema: {
        cardId: id,
        version: z.number().int().min(1),
        title,
        description,
      },
    },
    run("update_card", async (args: { cardId: string; version: number; title?: string; description?: string }) =>
      compactCard(
        await updateCard(actor, {
          cardId: args.cardId,
          expectedVersion: args.version,
          title: args.title,
          description: args.description,
        }),
      ),
    ),
  );

  server.registerTool(
    "move_card",
    {
      description:
        "Move one card to a list (or within its list) at a zero-based position; defaults to the end. Pass the version you read.",
      inputSchema: {
        cardId: id,
        toListId: MoveCard.shape.toListId,
        position: MoveCard.shape.position.optional(),
        version: z.number().int().min(1),
      },
    },
    run("move_card", async (args: { cardId: string; toListId: string; position?: number; version: number }) =>
      compactCard(
        await moveCard(actor, {
          cardId: args.cardId,
          toListId: args.toListId,
          position: args.position,
          expectedVersion: args.version,
        }),
      ),
    ),
  );

  server.registerTool(
    "add_comment",
    {
      description:
        "Comment on any card in your workspace. Retrying with the same externalKey and body adds nothing new.",
      inputSchema: {
        cardId: id,
        body,
        externalKey,
      },
    },
    run("add_comment", async (args: { cardId: string; body: string; externalKey: string }) => {
      const { comment, created } = await addComment(actor, args);
      return { commentId: comment.id, created };
    }),
  );

  server.registerTool(
    "mark_duplicate",
    {
      description:
        "Mark a card you may edit as a duplicate of a canonical card (any list) by adding a duplicate comment. Neither card is deleted.",
      inputSchema: {
        cardId: id,
        canonicalCardId: id,
        note: body.optional(),
        externalKey,
      },
    },
    run("mark_duplicate", async (args: { cardId: string; canonicalCardId: string; note?: string; externalKey: string }) => {
      const { comment, created } = await markDuplicate(actor, args);
      return { commentId: comment.id, created };
    }),
  );

  server.registerTool(
    "get_changes",
    {
      description:
        "Events in your workspace after a cursor, in order, each with a stable eventId. Start without a cursor, then pass nextCursor.",
      inputSchema: {
        cursor: z.string().max(20).optional(),
        limit: z.number().int().min(1).max(LIMITS.page).optional(),
      },
    },
    run("get_changes", (args: { cursor?: string; limit?: number }) =>
      getChanges(actor, args),
    ),
  );

  server.registerTool(
    "report_friction",
    {
      description: `File a friction report (a confusing or missing tool, an unexpected denial, anything the server cannot see) into Cardigan's suggestion box. Write-only: the receipt says only whether it was new or a repeat. Do not include secrets; token-shaped text is redacted. At most ${LIMITS.frictionPerHour} new reports per hour.`,
      inputSchema: {
        reportKey: externalKey,
        component: z.enum(FRICTION_COMPONENTS),
        category: z.enum(FRICTION_CATEGORIES),
        tool: z.enum([...TOOL_NAMES, "none"]),
        impact: z.enum(FRICTION_IMPACTS),
        description: z.string().trim().min(1).max(LIMITS.frictionDescription),
      },
    },
    run("report_friction", (args: Parameters<typeof reportFriction>[1]) =>
      reportFriction(actor, args),
    ),
  );

  return server;
};
