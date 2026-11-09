"use client";

import { useDeferredValue, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { updateCard } from "@/actions/update-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { ASSIGNEE_MAX, CARD_PRIORITIES } from "@/lib/domain/card-fields";
import { LIMITS } from "@/lib/domain/limits";
import { fetcher } from "@/lib/fetcher";
import { CardWithListAndLabels } from "@/types";
import { CardConflict } from "./card-conflict";

type Option = { id: string; title: string };

export const Planning = ({ data }: { data: CardWithListAndLabels }) => {
  const [editing, setEditing] = useState(false);
  return (
    <section aria-label="Card planning" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">Planning</h3>
        {!editing && <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing(true)}>Edit planning</Button>}
      </div>
      {editing ? <PlanningEditor data={data} close={() => setEditing(false)} /> : (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs text-muted-foreground">Priority</dt><dd className="capitalize">{data.priority}</dd></div>
          <div className="min-w-0"><dt className="text-xs text-muted-foreground">Assignee</dt><dd className="break-words">{data.assignee || "Unassigned"}</dd></div>
          <div className="col-span-2"><dt className="text-xs text-muted-foreground">Blocked by</dt><dd>{data.blockedBy.length ? data.blockedBy.map((d) => d.blocker.title).join(", ") : "None"}</dd></div>
        </dl>
      )}
    </section>
  );
};

const PlanningEditor = ({ data, close }: { data: CardWithListAndLabels; close: () => void }) => {
  const params = useParams();
  const router = useRouter();
  const client = useQueryClient();
  const version = useRef(data.version);
  const [priority, setPriority] = useState(data.priority);
  const [assignee, setAssignee] = useState(data.assignee ?? "");
  const [blockers, setBlockers] = useState<Option[]>(() => data.blockedBy.map((d) => d.blocker));
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [conflict, setConflict] = useState(false);
  const [message, setMessage] = useState("");
  const options = useQuery<{ cards: Option[]; hasMore: boolean }>({
    queryKey: ["blocker-options", data.id, deferredQuery],
    queryFn: () => fetcher(`/api/cards/blocker-options?query=${encodeURIComponent(deferredQuery)}`),
    retry: false,
  });
  const { execute, isLoading } = useAction(updateCard, {
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["card", data.id] });
      void client.invalidateQueries({ queryKey: ["card-logs", data.id] });
      router.refresh();
      close();
    },
  });
  const choices = options.data?.cards.filter((c) => c.id !== data.id && !blockers.some((b) => b.id === c.id));

  return (
    <form className="space-y-3" onSubmit={async (event) => {
      event.preventDefault();
      if (isLoading) return;
      setMessage("");
      setConflict(false);
      const result = await execute({ id: data.id, boardId: params.boardId as string,
        version: version.current, priority, assignee, blockedByIds: blockers.map((b) => b.id) });
      if (result?.domainError?.type === "stale_version") setConflict(true);
      setMessage(result?.error ?? Object.values(result?.fieldErrors ?? {}).flat().join(" "));
    }}>
      <fieldset disabled={isLoading} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">Priority
            <select name="priority" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className="h-9 w-full rounded-md border bg-background px-2 capitalize focus-visible:outline-2 focus-visible:outline-ring">
              {CARD_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">Assignee
            <Input name="assignee" value={assignee} maxLength={ASSIGNEE_MAX} autoComplete="off" placeholder="Person or agent…" onChange={(e) => setAssignee(e.target.value)} />
          </label>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Blocked by</legend>
          {blockers.map((b) => <label key={b.id} className="flex items-start gap-2 rounded-md bg-muted p-2 text-sm">
            <input type="checkbox" name="blocker" className="mt-1" checked onChange={() => setBlockers(blockers.filter((v) => v.id !== b.id))} />
            <span className="min-w-0 break-words">{b.title}</span>
          </label>)}
          <Input name="blockerSearch" aria-label="Search workspace cards" autoComplete="off" maxLength={LIMITS.query} placeholder="Search workspace cards…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border p-2 text-sm" aria-live="polite" aria-busy={options.isFetching}>
            {options.isError ? <p>Could not load cards. <Button type="button" variant="ghost" size="sm" onClick={() => { void options.refetch(); }}>Retry</Button></p>
              : !options.data ? <p>Loading cards…</p> : <>
                {choices?.length ? choices.map((c) => <label key={c.id} className="flex items-start gap-2 p-1">
                  <input type="checkbox" name="blockerOption" className="mt-1" checked={false} onChange={() => setBlockers([...blockers, c])} />
                  <span className="min-w-0 break-words">{c.title}</span>
                </label>) : <p>No matching cards.</p>}
                {options.data.hasMore && <p className="text-muted-foreground">More cards available. Narrow your search.</p>}
              </>}
          </div>
        </fieldset>
      </fieldset>
      {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
      {conflict && <CardConflict cardId={data.id} onReload={(latest) => { version.current = latest.version; }} />}
      <div className="flex gap-2">
        <Button size="sm" disabled={isLoading}>{isLoading ? "Saving…" : "Save planning"}</Button>
        <Button type="button" variant="ghost" size="sm" disabled={isLoading} onClick={close}>Cancel</Button>
      </div>
    </form>
  );
};
