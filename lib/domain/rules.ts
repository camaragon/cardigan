import { ACTOR_KIND } from "@prisma/client";
import { Actor, Capability, hasCapability } from "./actor";
import { RuleDenial } from "./errors";

/**
 * Who a list rule allows: the owner, any non-owner member, a named agent role
 * ("role:<key>"), or "any" (every person and agent in the workspace).
 */
export type Who = "owner" | "member" | "any" | `role:${string}`;

/**
 * List rules (ADR 0004), stored as JSON on a list. Lists deny by default: a
 * move from this list to a target is allowed only when `moveTo` names the
 * target list's template key (or "*") and includes the actor.
 */
export interface ListRules {
  /** Who may create a card in this list. */
  create: Who[];
  /** Who may edit cards in this list (fields, labels, duplicate marks). */
  edit: Who[];
  /** Who may reorder cards within this list. */
  reorder: Who[];
  /** Per target list template key, who may move a card from this list there. */
  moveTo: Record<string, Who[]>;
}

export type BoardTemplateKey = "plain" | "product";

const OPEN: ListRules = {
  create: ["any"],
  edit: ["any"],
  reorder: ["any"],
  moveTo: { "*": ["any"] },
};

const OWNER_ONLY: ListRules = {
  create: ["owner"],
  edit: ["owner"],
  reorder: ["owner"],
  moveTo: { "*": ["owner"] },
};

export interface RuleList {
  title: string;
  templateKey: string | null;
  rules: unknown;
}

/** The list's own rules, or its board template's default for lists without one. */
export const effectiveRules = (
  list: RuleList,
  boardTemplate: string,
): ListRules => {
  if (list.rules && typeof list.rules === "object") {
    return list.rules as ListRules;
  }
  return boardTemplate === "product" ? OWNER_ONLY : OPEN;
};

export const actorMatches = (actor: Actor, who: Who[]): boolean =>
  who.some((w) => {
    if (w === "any") return true;
    if (w === "owner") return actor.kind === ACTOR_KIND.OWNER;
    if (w === "member") return actor.kind === ACTOR_KIND.MEMBER;
    return actor.kind === ACTOR_KIND.AGENT && `role:${actor.role?.key}` === w;
  });

/** Plain words for a rule's allowed actors, for denials and settings pages. */
export const describeWho = (
  who: Who[],
  roleNames: Record<string, string> = {},
): string[] => {
  if (who.length === 0) return ["no one"];
  return who.map((w) => {
    if (w === "any") return "anyone in the workspace";
    if (w === "owner") return "the owner";
    if (w === "member") return "members";
    const key = w.slice("role:".length);
    return `${roleNames[key] ?? key} agents`;
  });
};

const moveTargetRule = (rules: ListRules, targetKey: string | null) =>
  (targetKey ? rules.moveTo[targetKey] : undefined) ?? rules.moveTo["*"] ?? [];

export type CardOperation =
  | { kind: "create"; list: RuleList }
  | { kind: "edit"; list: RuleList }
  | { kind: "duplicate"; list: RuleList }
  | { kind: "reorder"; list: RuleList }
  | { kind: "move"; from: RuleList; to: RuleList };

const CAPABILITY_FOR: Record<CardOperation["kind"], Capability> = {
  create: "create",
  edit: "update",
  duplicate: "duplicate",
  reorder: "move",
  move: "move",
};

/**
 * Checks one card operation against the actor's role capabilities and the
 * lists' rules. Returns null when allowed, or the denial that refuses it.
 * Pure, so it can be checked exhaustively in unit tests.
 */
export const checkCardOperation = (
  actor: Actor,
  op: CardOperation,
  boardTemplate: string,
  roleNames: Record<string, string> = {},
): RuleDenial | null => {
  const capability = CAPABILITY_FOR[op.kind];
  if (!hasCapability(actor, capability)) {
    return {
      rule: "role.capability",
      allowed: [`agent roles with the "${capability}" capability`, "people"],
      alternative: "Comment on the card to ask someone who may do this.",
    };
  }

  if (op.kind === "move") {
    const rules = effectiveRules(op.from, boardTemplate);
    const who = moveTargetRule(rules, op.to.templateKey);
    if (actorMatches(actor, who)) return null;
    return {
      rule: "list.exit",
      allowed: describeWho(who, roleNames).map(
        (w) => `${w} (from ${op.from.title} to ${op.to.title})`,
      ),
      alternative: `Comment on the card to ask for the move to ${op.to.title}.`,
    };
  }

  const rules = effectiveRules(op.list, boardTemplate);
  const ruleName = op.kind === "duplicate" ? "edit" : op.kind;
  const who = rules[ruleName];
  if (actorMatches(actor, who)) return null;

  const alternatives: Record<typeof ruleName, string> = {
    create: `Create the card in a list you may enter, or comment on an existing card instead of creating in ${op.list.title}.`,
    edit: `Comment on the card to suggest the change instead of editing it in ${op.list.title}.`,
    reorder: `Comment on the card to ask for a new position in ${op.list.title}.`,
  };
  return {
    rule: ruleName === "create" ? "list.enter" : `list.${ruleName}`,
    allowed: describeWho(who, roleNames),
    alternative: alternatives[ruleName],
  };
};

/** Everyone may comment on any card they can see (ADR 0004). */
export const checkComment = (actor: Actor): RuleDenial | null =>
  hasCapability(actor, "comment")
    ? null
    : {
        rule: "role.capability",
        allowed: ['agent roles with the "comment" capability', "people"],
        alternative: "Ask the owner to give your role the comment capability.",
      };

/** Plain-words summary of a list's rules, for settings pages and describe. */
export const describeRules = (
  list: RuleList,
  boardTemplate: string,
  roleNames: Record<string, string> = {},
) => {
  const rules = effectiveRules(list, boardTemplate);
  return {
    create: describeWho(rules.create, roleNames),
    edit: describeWho(rules.edit, roleNames),
    reorder: describeWho(rules.reorder, roleNames),
    moveTo: Object.fromEntries(
      Object.entries(rules.moveTo).map(([target, who]) => [
        target === "*" ? "any list" : target,
        describeWho(who, roleNames),
      ]),
    ),
  };
};
