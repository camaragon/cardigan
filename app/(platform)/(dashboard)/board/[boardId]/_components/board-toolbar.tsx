"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Filter, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BoardFilters, creatorKey, emptyBoardFilters, hasBoardFilters } from "@/lib/board-filters";
import type { ListWithCards } from "@/types";

// Loaded cards own the toolbar state; the fixed header owns its placement.
const subscribe = () => () => {};
const toolbarTarget = () => document.getElementById("board-toolbar");
const serverTarget = () => null;

interface BoardToolbarProps {
  lists: ListWithCards[];
  filters: BoardFilters;
  onChange: (filters: BoardFilters) => void;
}

export function BoardToolbar({ lists, filters, onChange }: BoardToolbarProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const target = useSyncExternalStore(subscribe, toolbarTarget, serverTarget);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const element = event.target;
      if (
        event.key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !(
          element instanceof HTMLElement &&
          (element.closest("input, textarea, select, [role='dialog']") || element.isContentEditable)
        )
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const cards = lists.flatMap((list) => list.cards);
  const labels = [
    ...new Map(
      cards.flatMap((card) => card.labels.map(({ label }) => [label.id, label] as const)),
    ).values(),
  ];
  const creators = [...new Map(cards.map((card) => [creatorKey(card), card] as const)).entries()];
  const buttonClass =
    "flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white";

  if (!target) return null;

  return createPortal(
    <div
      role="search"
      aria-label="Search and filter cards"
      className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-initial"
    >
      <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md bg-white/15 px-2.5 focus-within:ring-2 focus-within:ring-white sm:w-48">
        <Search aria-hidden="true" className="size-4 shrink-0" />
        <input
          ref={searchRef}
          aria-label="Search cards"
          name="board-search"
          autoComplete="off"
          placeholder="Search cards…"
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              onChange({ ...filters, search: "" });
            }
          }}
          className="w-full min-w-0 bg-transparent text-sm text-white placeholder:text-white/75 outline-none"
        />
        <kbd aria-hidden="true" className="rounded bg-white/15 px-1 text-xs">
          /
        </kbd>
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`${buttonClass} ${hasBoardFilters(filters) ? "bg-white/20" : ""}`}
            aria-label="Filter cards"
          >
            <Filter aria-hidden="true" className="size-4" />
            Filter
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="max-h-[70dvh] max-w-[calc(100vw-2rem)] overflow-y-auto space-y-4 text-sm"
        >
          <fieldset>
            <legend className="mb-2 font-medium">Labels (match any)</legend>
            {labels.length === 0 && <p className="text-muted-foreground">No labels on cards</p>}
            {labels.map((label) => (
              <label key={label.id} className="flex items-center gap-2 py-1.5 break-words">
                <input
                  type="checkbox"
                  name="board-label"
                  checked={filters.labels.includes(label.id)}
                  onChange={(event) =>
                    onChange({
                      ...filters,
                      labels: event.target.checked
                        ? [...filters.labels, label.id]
                        : filters.labels.filter((id) => id !== label.id),
                    })
                  }
                />
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                {label.name}
              </label>
            ))}
          </fieldset>
          <label className="block space-y-1">
            <span className="font-medium">Creator kind</span>
            <select
              className="w-full rounded border bg-background p-2 text-foreground"
              name="creator-kind"
              value={filters.kind}
              onChange={(event) =>
                onChange({
                  ...filters,
                  kind: event.target.value as BoardFilters["kind"],
                })
              }
            >
              <option value="">People and agents</option>
              <option value="people">People</option>
              <option value="agents">Agents</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="font-medium">Creator</span>
            <select
              className="w-full rounded border bg-background p-2 text-foreground"
              name="creator"
              value={filters.creator}
              onChange={(event) => onChange({ ...filters, creator: event.target.value })}
            >
              <option value="">All creators</option>
              {creators.map(([key, card]) => (
                <option key={key} value={key}>
                  {card.creatorName || "Unknown creator"} (
                  {card.creatorKind === "AGENT" ? "Agent" : "Person"})
                </option>
              ))}
            </select>
          </label>
        </PopoverContent>
      </Popover>
      {hasBoardFilters(filters) && (
        <button type="button" onClick={() => onChange(emptyBoardFilters)} className={buttonClass}>
          Clear all
        </button>
      )}
    </div>,
    target,
  );
}
