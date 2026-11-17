"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateBoard } from "@/actions/update-board";
import { useAction } from "@/hooks/use-action";
import { KeyPrefixInput } from "@/components/form/key-prefix-input";
import { Button } from "@/components/ui/button";

export const BoardCardKeys = ({ boardId, prefix }: { boardId: string; prefix: string | null }) => {
  const [draft, setDraft] = useState(prefix ?? "");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { execute, isLoading, fieldErrors } = useAction(updateBoard, {
    onSuccess: () => {
      toast.success("Card keys updated");
      void queryClient.invalidateQueries({ queryKey: ["card"] });
      router.refresh();
    },
    onError: error => toast.error(error),
  });
  return (
    <form className="space-y-3 border-y px-5 py-3" action={() => { void execute({ id: boardId, keyPrefix: draft }); }}>
      <KeyPrefixInput value={draft} onChange={setDraft} disabled={isLoading} errors={fieldErrors?.keyPrefix} />
      <p className="text-xs text-muted-foreground">
        {prefix ? "Numbers stay the same. Old keys still find their cards." : "Number existing cards in creation order. Once enabled, keys stay on."}
      </p>
      <Button type="submit" size="sm" disabled={isLoading}>
        {isLoading ? "Saving…" : prefix ? "Save prefix" : "Enable card keys"}
      </Button>
    </form>
  );
};
