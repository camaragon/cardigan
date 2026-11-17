import { expect, it } from "vitest";
import {
  creatorKey,
  emptyBoardFilters,
  hasBoardFilters,
  matchesBoardFilters,
} from "@/lib/board-filters";

it("searches loaded text, matches any selected label, and intersects creator filters", () => {
  const card: Parameters<typeof matchesBoardFilters>[0] = {
    title: "Improve navigation",
    key: "DEMO-12",
    keyAliases: ["ABC-12"],
    description: "Keyboard shortcuts",
    creatorKind: "OWNER",
    creatorId: "person_demo",
    creatorName: "Demo creator",
    labels: [{ label: { id: "label_demo" } }],
  };
  const agent = {
    ...card,
    creatorKind: "AGENT" as const,
    creatorId: "agent_demo",
  };
  const filters = {
    search: " KEYBOARD ",
    labels: ["other_label", "label_demo"],
    kind: "people" as const,
    creator: creatorKey(card),
  };
  expect(hasBoardFilters(emptyBoardFilters)).toBe(false);
  expect(hasBoardFilters({ ...emptyBoardFilters, search: "  " })).toBe(false);
  expect(hasBoardFilters(filters)).toBe(true);
  expect(matchesBoardFilters(card, emptyBoardFilters)).toBe(true);
  expect(matchesBoardFilters(card, { ...emptyBoardFilters, search: "NAVIGATION" })).toBe(true);
  expect(matchesBoardFilters(card, filters)).toBe(true);
  for (const search of ["demo-12", "abc-12"]) {
    expect(matchesBoardFilters(card, { ...emptyBoardFilters, search })).toBe(true);
  }
  for (const search of ["demo", "demo-1", "abc", "abc-1"]) {
    expect(matchesBoardFilters(card, { ...emptyBoardFilters, search })).toBe(false);
  }
  expect(matchesBoardFilters({ ...card, creatorKind: "MEMBER" }, filters)).toBe(true);
  expect(matchesBoardFilters(agent, filters)).toBe(false);
  expect(
    matchesBoardFilters(agent, {
      ...filters,
      kind: "agents",
      creator: creatorKey(agent),
    }),
  ).toBe(true);
  expect(matchesBoardFilters(card, { ...filters, search: "missing" })).toBe(false);
  expect(matchesBoardFilters(card, { ...filters, labels: ["other_label"] })).toBe(false);
  expect(matchesBoardFilters(card, { ...filters, creator: creatorKey(agent) })).toBe(false);
  expect(
    matchesBoardFilters(
      { ...card, description: null, labels: [] },
      { ...emptyBoardFilters, search: "keyboard" },
    ),
  ).toBe(false);
  expect(creatorKey({ ...card, creatorId: null })).not.toBe(
    creatorKey({ ...agent, creatorId: null }),
  );
});
