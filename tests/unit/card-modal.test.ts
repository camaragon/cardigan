import { beforeEach, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { skipToken } from "@tanstack/react-query";
import { FetchError } from "@/lib/fetcher";

const state = vi.hoisted(() => ({
  modal: { id: "deleted" as string | undefined, isOpen: true, onClose: vi.fn() },
  card: {} as Record<string, unknown>,
  relatedError: false, queries: [] as Record<string, unknown>[],
  retry: vi.fn(),
}));
vi.mock("@/hooks/use-card-modal", () => ({
  useCardModal: (selector: (value: typeof state.modal) => unknown) => selector(state.modal),
}));
vi.mock("@tanstack/react-query", async (original) => ({
  ...await original<typeof import("@tanstack/react-query")>(),
  useQuery: (options: Record<string, unknown>) => {
    state.queries.push(options);
    const key = options.queryKey as string[];
    return key[0] === "card" ? { refetch: state.retry, ...state.card }
      : { data: undefined, isError: state.relatedError, refetch: state.retry };
  },
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => children,
  DialogContent: ({ children }: { children: ReactNode }) => createElement("div", {}, children),
  DialogTitle: ({ children }: { children: ReactNode }) => createElement("h2", {}, children),
}));
vi.mock("@/components/modal/card-modal/header", () => ({ Header: Object.assign(() => "Header", { Skeleton: () => "Loading header" }) }));
vi.mock("@/components/modal/card-modal/description", () => ({ Description: Object.assign(() => "Description", { Skeleton: () => "Loading description" }) }));
vi.mock("@/components/modal/card-modal/labels", () => ({ Labels: Object.assign(() => "Labels", { Skeleton: () => "Loading labels" }) }));
vi.mock("@/components/modal/card-modal/actions", () => ({ Actions: () => "Actions" }));
vi.mock("@/components/modal/card-modal/activity", () => ({ Activity: Object.assign(() => "Activity", { Skeleton: () => "Loading activity" }) }));
vi.mock("@/components/modal/card-modal/comments", () => ({ Comments: Object.assign(() => "Comments", { Skeleton: () => "Loading comments" }), CommentForm: () => "Comment form" }));
import { CardModal } from "@/components/modal/card-modal";
const render = () => renderToStaticMarkup(createElement(CardModal));
beforeEach(() => {
  state.modal.id = "deleted"; state.modal.isOpen = true;
  state.card = { data: undefined, isSuccess: false, isError: false };
  state.queries = []; state.relatedError = false; vi.clearAllMocks();
});

it.each([401, 404, 500])("renders HTTP %s distinctly with retry/close instead of endless loading", (status) => {
  state.card = { error: new FetchError(status), isError: true, isSuccess: false };
  const html = render();
  expect(html).toContain(status === 404 ? "Card not found" : status === 401 ? "Sign-in required" : "Unable to load card");
  expect(html).toContain("Retry"); expect(html).toContain("Close");
  expect(html).not.toContain("Loading header"); expect(html).not.toContain("Comment form");
  expect(state.queries.slice(1).every((query) => query.enabled === false)).toBe(true);
});

it("treats a legacy successful null response as missing", () => {
  state.card = { data: null, isSuccess: true };
  expect(render()).toContain("Card not found");
});

it.each(["closed", "no id"])("disables queries when %s, with no undefined-id query function", (mode) => {
  if (mode === "closed") state.modal.isOpen = false;
  else state.modal.id = undefined;
  render();
  expect(state.queries.every((query) => query.enabled === false)).toBe(true);
  if (mode === "no id") expect(state.queries.every((query) => query.queryFn === skipToken)).toBe(true);
});

it("renders related read failures with retry once the card is ready", () => {
  state.card = { data: { title: "Demo card", priority: "none", assignee: null, blockedBy: [] }, isSuccess: true };
  state.relatedError = true;
  const html = render();
  expect(state.queries.every((query) => query.enabled === true)).toBe(true);
  expect(html).toContain("Unable to load comments"); expect(html).toContain("Unable to load activity");
  expect(html).not.toContain("Loading comments"); expect(html).not.toContain("Loading activity");
});

it("wires retry and close to the failed card read and modal store", () => {
  state.card = { error: new FetchError(500), isError: true, isSuccess: false };
  const visit = (node: ReactNode): void => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!node || typeof node !== "object" || !("props" in node)) return;
    const props = node.props as { children?: ReactNode; retry?: () => void; onClick?: () => void };
    props.retry?.();
    if (props.children === "Close") props.onClick?.();
    visit(props.children);
  };
  visit(CardModal());
  expect(state.retry).toHaveBeenCalledOnce();
  expect(state.modal.onClose).toHaveBeenCalledOnce();
});
