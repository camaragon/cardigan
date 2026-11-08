import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { useAction } from "@/hooks/use-action";

it("returns stale-version metadata to the editor after a rejected action", async () => {
  const draft = { description: "My draft", version: 1 };
  const conflict = {
    error: "Card changed",
    domainError: { type: "stale_version" as const, message: "Card changed" },
  };
  const action = vi.fn(async (_input: typeof draft) => conflict);
  let execute: ReturnType<typeof useAction<typeof draft, never>>["execute"];
  function Editor() {
    // eslint-disable-next-line react-hooks/globals -- Capture the public callback in this test probe.
    execute = useAction<typeof draft, never>(action).execute;
    return null;
  }
  renderToString(createElement(Editor));

  expect(await execute!(draft)).toEqual(conflict);
  expect(action).toHaveBeenCalledWith(draft);
});
