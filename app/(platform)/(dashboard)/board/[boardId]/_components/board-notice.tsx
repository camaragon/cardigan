"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { updateBoard } from "@/actions/update-board";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormSubmit } from "@/components/form/form-submit";

export function BoardNotice({
  boardId,
  notice,
  canEdit = true,
}: {
  boardId: string;
  notice: string | null;
  canEdit?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const restoringFocus = useRef(false);
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

  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  const keepOpen = () => clearTimeout(closeTimer.current);
  const closeAfterLeave = () => {
    keepOpen();
    closeTimer.current = setTimeout(() => {
      if (
        !editing &&
        document.activeElement !== triggerRef.current &&
        !contentRef.current?.contains(document.activeElement)
      )
        setOpen(false);
    }, 150);
  };

  if (!notice && !canEdit) return null;

  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        keepOpen();
        setOpen(value);
        if (!value) setEditing(false);
      }}
    >
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label={notice ? "Board notice" : "Add notice"}
          className="flex min-w-0 max-w-24 sm:max-w-56 shrink items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs text-white hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") {
              keepOpen();
              setOpen(true);
            }
          }}
          onPointerLeave={closeAfterLeave}
          onFocus={(event) => {
            if (
              !restoringFocus.current &&
              event.currentTarget.matches(":focus-visible")
            )
              setOpen(true);
            restoringFocus.current = false;
          }}
          onBlur={closeAfterLeave}
        >
          <Info aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{notice || "Add notice"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        align="start"
        aria-label="Board notice"
        className="board-scrollbar max-h-[calc(100dvh-8rem)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto"
        onPointerEnter={keepOpen}
        onPointerLeave={closeAfterLeave}
        onBlur={closeAfterLeave}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={() => { restoringFocus.current = true; }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (restoringFocus.current) triggerRef.current?.focus();
          restoringFocus.current = false;
        }}
      >
        {editing && canEdit ? (
          <form
            action={async (data) => { await execute({ id: boardId, notice: String(data.get("notice") ?? "") }); }}
            className="space-y-2"
          >
            <label htmlFor={id} className="text-sm font-medium">Board notice</label>
            <Textarea ref={textareaRef} id={id} name="notice" autoComplete="off" defaultValue={notice ?? ""} maxLength={2000} disabled={isLoading} aria-describedby={`${id}-help ${id}-error`} />
            <p id={`${id}-help`} className="text-xs text-muted-foreground">Leave empty to clear the notice.</p>
            <p id={`${id}-error`} role="status" className="text-sm text-red-600">{fieldErrors?.notice?.join(" ") || error}</p>
            <div className="flex gap-2">
              <FormSubmit disabled={isLoading}>{isLoading ? "Saving…" : "Save notice"}</FormSubmit>
              <Button type="button" size="sm" variant="ghost" disabled={isLoading} onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium">Board notice</p>
            {notice && (
              <p className="whitespace-pre-wrap break-words text-sm">
                {notice}
              </p>
            )}
            {canEdit && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditing(true)}
              >
                {notice ? "Edit notice" : "Add notice"}
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
