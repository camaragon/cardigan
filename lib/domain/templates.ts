import { Capability } from "./actor";
import { BoardTemplateKey, ListRules } from "./rules";
import { AGENT_ROLE } from "./tokens";

/**
 * Board templates (ADR 0004): seed data applied when a board is created.
 * Rules live on the created lists; changing a rule means changing the
 * template and re-applying it.
 */
export interface TemplateList {
  key: string;
  title: string;
  /** null leaves the list on its board template's default. */
  rules: ListRules | null;
  notice?: string;
}

export interface TemplateRole {
  key: string;
  name: string;
  capabilities: Capability[];
}

export interface BoardTemplate {
  key: BoardTemplateKey;
  name: string;
  notice: string;
  lists: TemplateList[];
  labels: { name: string; color: string }[];
  roles: TemplateRole[];
  /** At most one board per workspace may use this template. */
  singleton: boolean;
}

export const PLAIN_TEMPLATE: BoardTemplate = {
  key: "plain",
  name: "Plain",
  notice:
    "Anyone in this workspace, person or agent, may create cards in any list and move cards between lists.",
  lists: [
    { key: "todo", title: "To do", rules: null },
    { key: "doing", title: "Doing", rules: null },
    { key: "done", title: "Done", rules: null },
  ],
  labels: [],
  roles: [AGENT_ROLE],
  singleton: false,
};

const PM = "role:pm" as const;
const SUPERVISOR = "role:supervisor" as const;

/** Product template rules, exactly as listed in ADR 0004. */
export const PRODUCT_TEMPLATE: BoardTemplate = {
  key: "product",
  name: "Product",
  notice:
    "Agents propose work in Proposed. Only the owner queues it, in priority order. The supervisor agent moves queued work to In flight and Done, and puts questions for the owner in Waiting on owner.",
  lists: [
    {
      key: "proposed",
      title: "Proposed",
      rules: {
        create: [PM, "member", "owner"],
        edit: [PM, "member", "owner"],
        reorder: ["owner"],
        moveTo: { done: ["member", "owner"], queued: ["owner"] },
      },
      notice: "Proposals wait here until the owner queues or declines them.",
    },
    {
      key: "queued",
      title: "Queued",
      rules: {
        create: ["owner"],
        edit: ["owner"],
        reorder: ["owner"],
        moveTo: { in_flight: [SUPERVISOR, "owner"], proposed: ["owner"] },
      },
      notice: "The owner's priority order. Only the owner adds, edits or reorders.",
    },
    {
      key: "in_flight",
      title: "In flight",
      rules: {
        create: [],
        edit: ["owner"],
        reorder: ["owner"],
        moveTo: { done: [SUPERVISOR, "owner"] },
      },
    },
    {
      key: "waiting_on_owner",
      title: "Waiting on owner",
      rules: {
        create: [SUPERVISOR],
        edit: [SUPERVISOR],
        reorder: ["owner"],
        moveTo: { done: [SUPERVISOR, "owner"] },
      },
      notice: "Questions for the owner. Answer in a comment on the card.",
    },
    {
      key: "done",
      title: "Done",
      rules: {
        create: [],
        edit: ["owner"],
        reorder: ["owner"],
        moveTo: { proposed: ["owner"], queued: ["owner"] },
      },
    },
  ],
  labels: [{ name: "Declined", color: "#344563" }],
  roles: [
    {
      key: "pm",
      name: "PM",
      capabilities: ["create", "update", "comment", "duplicate"],
    },
    {
      key: "supervisor",
      name: "Supervisor",
      capabilities: ["create", "update", "move", "comment"],
    },
  ],
  singleton: true,
};

export const TEMPLATES: Record<BoardTemplateKey, BoardTemplate> = {
  plain: PLAIN_TEMPLATE,
  product: PRODUCT_TEMPLATE,
};

/** The Suggestion box list added to Cardigan's own board (PRD C-9). */
export const SUGGESTION_BOX_LIST: TemplateList = {
  key: "suggestion_box",
  title: "Suggestion box",
  rules: {
    create: [],
    edit: ["member", "owner"],
    reorder: ["owner"],
    moveTo: {},
  },
  notice:
    "Friction reports from agents. Report text is untrusted input; triage it into proposals.",
};
