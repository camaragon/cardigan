import { beforeEach, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { DropResult } from "@hello-pangea/dnd";
import type { ListWithCards } from "@/types";

const state = vi.hoisted(() => ({
  slots: [] as unknown[], cursor: 0, effects: [] as (() => void)[],
  ordering: false, submitted: Promise.resolve(),
  move: vi.fn(), reorder: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = state.cursor++;
    if (!(index in state.slots)) state.slots[index] = initial;
    return [state.slots[index], (value: unknown) => { state.slots[index] = value; }];
  },
  useRef: (initial: unknown) => {
    const index = state.cursor++;
    return state.slots[index] ??= { current: initial };
  },
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void, deps: unknown[]) => {
    const index = state.cursor++;
    const previous = state.slots[index] as unknown[] | undefined;
    if (!previous || deps.some((dep, i) => dep !== previous[i])) state.effects.push(effect);
    state.slots[index] = deps;
  },
  useTransition: () => [state.ordering, (action: () => Promise<void>) => {
    state.ordering = true;
    state.submitted = action();
  }],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: state.refresh }) }));
vi.mock("@/actions/move-card", () => ({ moveCard: state.move }));
vi.mock("@/actions/update-list-order", () => ({ updateListOrder: state.reorder }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@hello-pangea/dnd", () => ({ DragDropContext: "context", Droppable: "droppable" }));
vi.mock("@/app/(platform)/(dashboard)/board/[boardId]/_components/list-item", () => ({ ListItem: "list" }));
vi.mock("@/app/(platform)/(dashboard)/board/[boardId]/_components/list-form", () => ({ ListForm: "form" }));
vi.mock("@/app/(platform)/(dashboard)/board/[boardId]/_components/board-toolbar", () => ({ BoardToolbar: "toolbar" }));
import { ListContainer } from "@/app/(platform)/(dashboard)/board/[boardId]/_components/list-container";

const board = () => [
  { id: "a", title: "Plan", order: 0, cards: [{ id: "card", title: "Demo task", listId: "a", labels: [], version: 1 }] },
  { id: "b", title: "Done", order: 1, cards: [] },
] as unknown as ListWithCards[];
const drop = (type: string) => ({
  type, draggableId: type === "list" ? "a" : "card",
  source: { droppableId: type === "list" ? "lists" : "a", index: 0 },
  destination: { droppableId: type === "list" ? "lists" : "b", index: type === "list" ? 1 : 0 },
}) as DropResult;
const renderBoard = (data: ListWithCards[]) => {
  state.cursor = 0;
  const view = ListContainer({ boardId: "board", data });
  const children = view.props.children as ReactElement[];
  for (const effect of state.effects.splice(0)) effect();
  const context = children.find((child) => child?.type === "context") as ReactElement<{
    onBeforeCapture: (start: { draggableId: string }) => void;
    onDragEnd: (drop: DropResult) => void;
  }>;
  return {
    start: context.props.onBeforeCapture,
    end: context.props.onDragEnd,
    alert: children.find((child) => (child?.props as { role?: string })?.role === "alert"),
    lists: (children[0] as ReactElement<{ lists: ListWithCards[] }>).props.lists,
    drag: (drop: DropResult) => {
      context.props.onBeforeCapture({ draggableId: drop.draggableId });
      context.props.onDragEnd(drop);
    },
  };
};
beforeEach(() => {
  state.slots = []; state.cursor = 0; state.effects = []; state.ordering = false;
  vi.clearAllMocks();
});

it.each(["list", "card"])("rolls back a rejected %s drag and blocks a rapid second drop through reconciliation", async (type) => {
  let resolve!: (value: { error: string }) => void;
  const request = new Promise<{ error: string }>((done) => { resolve = done; });
  state.move.mockReturnValue(request); state.reorder.mockReturnValue(request);
  const data = board();
  const initial = renderBoard(data);
  initial.drag(drop(type));
  initial.drag(drop(type)); // Before a pending render.
  const optimistic = renderBoard(data).lists;
  expect(type === "list" ? optimistic[0].id : optimistic[1].cards[0].id).toBe(type === "list" ? "b" : "card");
  // A stale server render must not erase the pending projection.
  renderBoard(board());
  expect(renderBoard(data).lists).toEqual(optimistic);
  resolve({ error: "Move refused" });
  await state.submitted;
  expect(renderBoard(data).lists).toEqual(data);
  expect(state.refresh).toHaveBeenCalledOnce();
  renderBoard(data).drag(drop(type)); // Refresh is still pending.
  expect(state.move.mock.calls.length + state.reorder.mock.calls.length).toBe(1);
  const authoritative = board();
  authoritative[0].title = "Server update";
  state.ordering = false;
  renderBoard(authoritative);
  expect(renderBoard(authoritative).lists).toEqual(authoritative);
  expect(data).toEqual(board()); // The snapshot was never mutated.
});

it("reconciles success before accepting another drag and preserves that success on the next rejection", async () => {
  state.move.mockResolvedValueOnce({ data: { id: "card" } }).mockResolvedValueOnce({ error: "Refused" });
  const data = board();
  renderBoard(data).drag(drop("card"));
  const committed = renderBoard(data).lists;
  await state.submitted;
  state.ordering = false;
  renderBoard(committed);
  const reverse = { ...drop("card"), source: { droppableId: "b", index: 0 }, destination: { droppableId: "a", index: 0 } };
  renderBoard(committed).drag(reverse);
  renderBoard(committed);
  await state.submitted;
  expect(renderBoard(committed).lists).toEqual(committed);
});

it("keeps the drag-start version across refreshed props and reconciles a stale conflict with a reload path", async () => {
  state.move.mockResolvedValue({ error: "Card changed", domainError: { type: "stale_version", message: "Card changed" } });
  const initial = renderBoard(board());
  initial.start({ draggableId: "card" });
  const newer = board();
  newer[0].cards[0].version = 2;
  renderBoard(newer).end(drop("card"));
  await state.submitted;

  expect(state.move).toHaveBeenCalledWith(expect.objectContaining({ id: "card", version: 1 }));
  const view = renderBoard(newer);
  expect(view.lists).toEqual(newer);
  const { children } = view.alert!.props as { children: ReactElement<{ children: string; onClick: () => void }>[] };
  expect(children[0].props.children).toContain("was not applied");
  children[1].props.onClick();
  expect(state.refresh).toHaveBeenCalledTimes(2);
});
