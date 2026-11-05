import { describe, expect, it } from "vitest";
import { ACTOR_KIND, SURFACE } from "@prisma/client";
import type { Actor } from "@/lib/domain/actor";
import { checkCardOperation } from "@/lib/domain/rules";
import { PRODUCT_TEMPLATE } from "@/lib/domain/templates";

// The product template's allowed moves and creates, written out from the
// ADR 0004 table independently of the template code. Anything not listed is
// denied. Owner, member, PM and supervisor are every kind of user on a
// product board.
const ALLOWED_MOVES: Record<string, string[]> = {
  "proposed->done": ["member", "owner"],
  "proposed->queued": ["owner"],
  "queued->in_flight": ["supervisor", "owner"],
  "queued->proposed": ["owner"],
  "in_flight->done": ["supervisor", "owner"],
  "waiting_on_owner->done": ["supervisor", "owner"],
  "done->proposed": ["owner"],
  "done->queued": ["owner"],
};
const ALLOWED_CREATE: Record<string, string[]> = {
  proposed: ["pm", "member", "owner"],
  queued: ["owner"],
  in_flight: [],
  waiting_on_owner: ["supervisor"],
  done: [],
};
const ALLOWED_EDIT: Record<string, string[]> = {
  proposed: ["pm", "member", "owner"],
  queued: ["owner"],
  in_flight: ["owner"],
  waiting_on_owner: ["supervisor"],
  done: ["owner"],
};

const person = (kind: ACTOR_KIND): Actor => ({
  kind,
  id: kind,
  name: kind,
  orgId: "org",
  surface: SURFACE.UI,
});
const agent = (key: string): Actor => {
  const role = PRODUCT_TEMPLATE.roles.find((r) => r.key === key)!;
  return {
    kind: ACTOR_KIND.AGENT,
    id: key,
    name: key,
    orgId: "org",
    surface: SURFACE.MCP,
    tokenId: key,
    role: { key, name: role.name, capabilities: role.capabilities },
  };
};
const ACTORS: Record<string, Actor> = {
  owner: person(ACTOR_KIND.OWNER),
  member: person(ACTOR_KIND.MEMBER),
  pm: agent("pm"),
  supervisor: agent("supervisor"),
};

const lists = Object.fromEntries(
  PRODUCT_TEMPLATE.lists.map((l) => [
    l.key,
    { title: l.title, templateKey: l.key, rules: l.rules },
  ]),
);
const keys = Object.keys(lists);

describe("product template rules", () => {
  it("covers exactly the five product lists", () => {
    expect(keys).toEqual(Object.keys(ALLOWED_CREATE));
  });

  for (const [who, actor] of Object.entries(ACTORS)) {
    it(`every move between lists for ${who}`, () => {
      for (const from of keys) {
        for (const to of keys) {
          const op =
            from === to
              ? ({ kind: "reorder", list: lists[from] } as const)
              : ({ kind: "move", from: lists[from], to: lists[to] } as const);
          const allowed =
            from === to
              ? who === "owner"
              : (ALLOWED_MOVES[`${from}->${to}`] ?? []).includes(who);
          const denial = checkCardOperation(actor, op, "product");
          expect(
            denial === null,
            `${who} ${from === to ? "reorder" : "move"} ${from}->${to}`,
          ).toBe(allowed);
        }
      }
    });

    it(`creates and edits in every list for ${who}`, () => {
      for (const key of keys) {
        const create = checkCardOperation(actor, { kind: "create", list: lists[key] }, "product");
        expect(create === null, `${who} create in ${key}`).toBe(
          ALLOWED_CREATE[key].includes(who),
        );
        const edit = checkCardOperation(actor, { kind: "edit", list: lists[key] }, "product");
        expect(edit === null, `${who} edit in ${key}`).toBe(
          ALLOWED_EDIT[key].includes(who),
        );
      }
    });
  }

  it("a list without rules on a product board is owner only", () => {
    const custom = { title: "Custom", templateKey: null, rules: null };
    expect(checkCardOperation(ACTORS.owner, { kind: "create", list: custom }, "product")).toBeNull();
    for (const who of ["member", "pm", "supervisor"]) {
      expect(checkCardOperation(ACTORS[who], { kind: "create", list: custom }, "product")).not.toBeNull();
    }
  });

  it("denials name the rule, who may act and an alternative", () => {
    const denial = checkCardOperation(
      ACTORS.member,
      { kind: "move", from: lists.proposed, to: lists.queued },
      "product",
    );
    expect(denial).toMatchObject({ rule: "list.exit", allowed: [expect.stringContaining("the owner")] });
    expect(denial?.alternative).toMatch(/comment/i);
  });
});
