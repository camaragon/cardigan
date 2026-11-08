import type { CardWithLabels } from "@/types";

type FilterCard = Pick<
  CardWithLabels,
  "title" | "description" | "creatorKind" | "creatorId" | "creatorName"
> & { labels: { label: { id: string } }[] };

export type BoardFilters = {
  search: string;
  labels: string[];
  kind: "" | "people" | "agents";
  creator: string;
};

export const emptyBoardFilters: BoardFilters = {
  search: "",
  labels: [],
  kind: "",
  creator: "",
};

export function creatorKey(card: FilterCard): string {
  // Older cards may have a name but no creator id.
  return JSON.stringify([
    card.creatorKind === "AGENT" ? "agents" : "people",
    card.creatorId ?? card.creatorName,
  ]);
}

export function matchesBoardFilters(card: FilterCard, filters: BoardFilters): boolean {
  const query = filters.search.trim().toLowerCase();
  return (
    (!query ||
      [card.title, card.description].some((text) => text?.toLowerCase().includes(query))) &&
    (!filters.labels.length ||
      card.labels.some(({ label }) => filters.labels.includes(label.id))) &&
    (!filters.kind || (card.creatorKind === "AGENT" ? "agents" : "people") === filters.kind) &&
    (!filters.creator || creatorKey(card) === filters.creator)
  );
}

export function hasBoardFilters(filters: BoardFilters): boolean {
  return Boolean(filters.search.trim() || filters.labels.length || filters.kind || filters.creator);
}
