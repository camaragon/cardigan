"use client";

import { useState } from "react";
import { CardWithListAndLabels } from "@/types";
import { Button } from "@/components/ui/button";

export const CardConflict = ({ cardId, onReload }: {
  cardId: string;
  onReload: (latest: CardWithListAndLabels) => void;
}) => {
  const [latest, setLatest] = useState<CardWithListAndLabels | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(`/api/cards/${cardId}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Reload failed");
      const card: CardWithListAndLabels | null = await response.json();
      if (!card) throw new Error("Card unavailable");
      setLatest(card);
      onReload(card);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div role="alert" className="my-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-neutral-800">
      <p>This card changed. Your draft is kept. Reload the latest card to compare before saving again.</p>
      <Button type="button" variant="outline" size="sm" className="mt-2" disabled={loading} onClick={reload}>
        {loading ? "Reloading…" : "Reload latest for comparison"}
      </Button>
      {error && <p>Could not reload this card. Your draft is still kept. Try again.</p>}
      {latest && (
        <div className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words">
          <p className="font-semibold">Latest saved card (version {latest.version})</p>
          <p>{latest.title} · {latest.list.title}</p>
          <p>{latest.description || "No description"}</p>
          <p>Priority: {latest.priority} · Assignee: {latest.assignee || "Unassigned"}</p>
          <p>Blocked by: {latest.blockedBy?.map((d) => d.blocker.title).join(", ") || "None"}</p>
          <p className="mt-2">Compare with your draft above, then save when ready.</p>
        </div>
      )}
    </div>
  );
};
