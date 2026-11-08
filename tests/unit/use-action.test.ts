/* eslint-disable react-hooks/rules-of-hooks -- React is mocked by the manual render loop below. */
import { beforeEach, expect, it, vi } from "vitest";
import type { ActionState } from "@/lib/create-safe-action";

// A minimal render loop keeps this hook regression independent of a DOM.
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }));
vi.mock("react", () => ({
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.slots)) hooks.slots[index] = initial;
    return [hooks.slots[index], (value: unknown) => { hooks.slots[index] = value; }];
  },
  useRef: (initial: unknown) => {
    const index = hooks.cursor++;
    return hooks.slots[index] ??= { current: initial };
  },
  useCallback: (callback: unknown) => callback,
}));
import { useAction } from "@/hooks/use-action";

type Input = { value: string };
type Outcome = ActionState<Input, boolean | string>;
const deferred = () => {
  let resolve!: (value: Outcome) => void;
  const promise = new Promise<Outcome>((done) => { resolve = done; });
  return { promise, resolve };
};
beforeEach(() => { hooks.slots = []; hooks.cursor = 0; });

it("clears failure on retry/success and success on validation failure, including false/empty data", async () => {
  const action = vi.fn<(input: Input) => Promise<Outcome>>()
    .mockResolvedValueOnce({ error: "Refused" })
    .mockResolvedValueOnce({ data: false })
    .mockResolvedValueOnce({ data: "" })
    .mockResolvedValueOnce({ fieldErrors: { value: ["Invalid"] } });
  const onSuccess = vi.fn();
  const render = () => { hooks.cursor = 0; return useAction(action, { onSuccess }); };
  await render().execute({ value: "first" });
  expect(render().error).toBe("Refused");
  const retry = render().execute({ value: "retry" });
  expect(render()).toMatchObject({ error: undefined, data: undefined, isLoading: true });
  await retry;
  expect(render()).toMatchObject({ error: undefined, data: false, isLoading: false });
  await render().execute({ value: "empty" });
  expect(onSuccess.mock.calls).toEqual([[false], [""]]);
  await render().execute({ value: "invalid" });
  expect(render()).toMatchObject({ data: undefined, error: undefined, fieldErrors: { value: ["Invalid"] } });
});

it.each([true, false])("keeps pending until both overlapping calls finish (newest first: %s)", async (newestFirst) => {
  const first = deferred();
  const second = deferred();
  const action = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const onComplete = vi.fn();
  const render = () => { hooks.cursor = 0; return useAction<Input, boolean | string>(action, { onComplete }); };
  const one = render().execute({ value: "one" });
  const two = render().execute({ value: "two" });
  if (newestFirst) { second.resolve({ data: "new" }); await two; }
  else { first.resolve({ error: "old" }); await one; }
  expect(render().isLoading).toBe(true);
  first.resolve({ error: "old" });
  second.resolve({ data: "new" });
  await Promise.all([one, two]);
  expect(render()).toMatchObject({ isLoading: false, error: undefined, data: "new" });
  expect(onComplete).toHaveBeenCalledTimes(2);
});

it("handles thrown errors with the existing error and completion callbacks", async () => {
  const onError = vi.fn();
  const onComplete = vi.fn();
  const action = vi.fn().mockRejectedValue(new Error("Connection lost"));
  const render = () => { hooks.cursor = 0; return useAction(action, { onError, onComplete }); };
  await render().execute({});
  expect(render()).toMatchObject({ error: "Connection lost", isLoading: false, data: undefined });
  expect(onError).toHaveBeenCalledWith("Connection lost");
  expect(onComplete).toHaveBeenCalledOnce();
});
