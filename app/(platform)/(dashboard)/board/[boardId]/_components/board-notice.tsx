"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateBoard } from "@/actions/update-board";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormSubmit } from "@/components/form/form-submit";

export function BoardNotice({ boardId, notice }: { boardId: string; notice: string | null }) {
  const [editing, setEditing] = useState(false);
  const id = useId();
  const router = useRouter();
  const { execute, isLoading, fieldErrors, error } = useAction(updateBoard, {
    onSuccess: () => {
      setEditing(false);
      toast.success("Board notice saved");
      router.refresh();
    },
  });

  if (editing) {
    return (
      <form
        action={async (data) => { await execute({ id: boardId, notice: String(data.get("notice") ?? "") }); }}
        className="mb-3 max-w-3xl space-y-2 rounded-md bg-white p-3 text-neutral-900"
      >
        <label htmlFor={id} className="text-sm font-medium">Board notice</label>
        <Textarea id={id} name="notice" autoComplete="off" defaultValue={notice ?? ""} maxLength={2000} disabled={isLoading} aria-describedby={`${id}-help ${id}-error`} />
        <p id={`${id}-help`} className="text-xs text-muted-foreground">Leave empty to clear the notice.</p>
        <p id={`${id}-error`} role="status" className="text-sm text-red-600">{fieldErrors?.notice?.join(" ") || error}</p>
        <div className="flex gap-2">
          <FormSubmit disabled={isLoading}>{isLoading ? "Saving…" : "Save notice"}</FormSubmit>
          <Button type="button" size="sm" variant="ghost" disabled={isLoading} onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="mb-3 flex max-w-3xl items-start gap-2 rounded-md bg-black/60 px-3 py-2 text-white">
      {notice && <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm">{notice}</p>}
      <Button type="button" size="sm" variant="transparent" className="shrink-0" onClick={() => setEditing(true)}>
        {notice ? "Edit notice" : "Add board notice"}
      </Button>
    </div>
  );
}
