"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CardConflict } from "./card-conflict";
import { Skeleton } from "@/components/ui/skeleton";
import { CardWithList } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { updateCard } from "@/actions/update-card";
import { useAction } from "@/hooks/use-action";
import { toast } from "sonner";

interface HeaderProps {
  data: CardWithList;
}

export const Header = ({ data }: HeaderProps) => {
  const [draft, setDraft] = useState<{ title: string; version: number } | null>(null);
  const [conflict, setConflict] = useState(false);
  const queryClient = useQueryClient();
  const params = useParams();

  const { execute, isLoading } = useAction(updateCard, {
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["card", data.id] });
      queryClient.invalidateQueries({ queryKey: ["card-logs", data.id] });
      setDraft(null);
      setConflict(false);
      toast.success(`Renamed to "${data.title}"`);
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const inputRef = useRef<HTMLInputElement>(null);

  const onBlur = () => {
    if (!conflict && !isLoading) inputRef.current?.form?.requestSubmit();
  };

  const onSubmit = async (formData: FormData) => {
    const title = formData.get("title") as string;
    const boardId = params.boardId as string;

    if (!draft) return;
    if (title === data.title) {
      setDraft(null);
      return;
    }

    const result = await execute({ title, boardId, id: data.id, version: draft.version });
    if (result?.domainError?.type === "stale_version") setConflict(true);
  };

  return (
    <div className="mb-3 w-full min-w-0 pr-16">
      <div className="w-full">
        <form action={onSubmit}>
          <label htmlFor="title" className="sr-only">Card title</label>
          <Input
            ref={inputRef}
            onBlur={onBlur}
            id="title"
            name="title"
            value={draft?.title ?? data.title}
            onFocus={() => setDraft((draft) => draft ?? { title: data.title, version: data.version })}
            onChange={(event) => setDraft({ title: event.target.value, version: draft?.version ?? data.version })}
            disabled={isLoading}
            className="shadow-none font-semibold text-xl px-1 text-neutral-700 bg-transparent border-transparent relative -left-1.5 w-full focus-visible:bg-white focus-visible:border-input mb-0.5 truncate"
          />
          {conflict && (
            <>
              <CardConflict cardId={data.id} onReload={(latest) => setDraft((draft) => draft && { ...draft, version: latest.version })} />
              <Button size="sm" disabled={isLoading}>Save draft</Button>
            </>
          )}
        </form>
        <p className="truncate text-sm text-muted-foreground">
          in list <span className="underline">{data.list.title}</span>
        </p>
      </div>
    </div>
  );
};

Header.Skeleton = function HeaderSkeleton() {
  return (
    <div className="flex items-start gap-x-3 mb-6">
      <Skeleton className="h-6 w-6 mt-1 bg-neutral-200" />
      <div>
        <Skeleton className="h-6 w-24 mb-1 bg-neutral-200" />
        <Skeleton className="h-4 w-12 mb-1 bg-neutral-200" />
      </div>
    </div>
  );
};
