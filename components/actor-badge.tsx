import { ACTOR_KIND } from "@prisma/client";
import { Bot } from "lucide-react";

/** Marks agent entries so they read distinctly from people (PRD C-5). */
export const ActorBadge = ({ kind }: { kind: ACTOR_KIND }) => {
  if (kind !== ACTOR_KIND.AGENT) return null;
  return (
    <span className="inline-flex items-center gap-x-0.5 rounded bg-violet-100 px-1 py-px text-[10px] font-semibold uppercase text-violet-700">
      <Bot className="h-3 w-3" />
      Agent
    </span>
  );
};
