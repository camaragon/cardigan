import { useState, useCallback, useRef } from "react";
import { ActionState } from "@/lib/create-safe-action";

type Action<TInput, TOutput> = (
  data: TInput,
) => Promise<ActionState<TInput, TOutput>>;

interface UseActionOptions<TOutput> {
  onSuccess?: (data: TOutput) => void;
  onError?: (error: string) => void;
  onComplete?: () => void;
}

export const useAction = <TInput, TOutput>(
  action: Action<TInput, TOutput>,
  options: UseActionOptions<TOutput> = {},
) => {
  const [result, setResult] = useState<ActionState<TInput, TOutput>>({});
  const [isLoading, setIsLoading] = useState(false);
  const pending = useRef(0);
  const latestRequest = useRef(0);

  const execute = useCallback(
    async (input: TInput) => {
      const request = ++latestRequest.current;
      pending.current++;
      setResult({});
      setIsLoading(true);

      try {
        let outcome: ActionState<TInput, TOutput>;
        try {
          outcome = await action(input);
        } catch (cause) {
          outcome = { error: cause instanceof Error ? cause.message : "Something went wrong" };
        }

        if (!outcome) return;

        // Only the newest invocation owns the displayed outcome.
        if (outcome.fieldErrors) {
          if (request === latestRequest.current) setResult({ fieldErrors: outcome.fieldErrors });
        } else if (outcome.error) {
          if (request === latestRequest.current) setResult({ error: outcome.error });
          options.onError?.(outcome.error);
        } else if ("data" in outcome) {
          if (request === latestRequest.current) setResult({ data: outcome.data });
          options.onSuccess?.(outcome.data as TOutput);
        }
      } finally {
        pending.current--;
        setIsLoading(pending.current > 0);
        options.onComplete?.();
      }
    },
    [action, options],
  );

  return {
    execute,
    fieldErrors: result.fieldErrors,
    error: result.error ?? undefined,
    data: result.data,
    isLoading,
  };
};
