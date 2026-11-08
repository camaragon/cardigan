"use client";

import { ListWithCards } from "@/types";
import { AlignLeft, Bot, MessageSquare } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Draggable } from "@hello-pangea/dnd";
import { useCardModal } from "@/hooks/use-card-modal";

interface CardItemProps {
  data: ListWithCards["cards"][number];
  index: number;
}

export const CardItem = ({ data, index }: CardItemProps) => {
  const cardModal = useCardModal();
  const creator = [
    data.creatorName,
    data.creatorKind === "AGENT" ? "Agent" : "Person",
    data.creatorSurface,
  ]
    .filter(Boolean)
    .join(" · ");
  const initials = data.creatorName
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((name) => name[0])
    .join("")
    .toUpperCase();

  return (
    <Draggable draggableId={data.id} index={index}>
      {(provided) => (
        <div
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          ref={provided.innerRef}
          role="button"
          tabIndex={0}
          onClick={() => cardModal.onOpen(data.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              cardModal.onOpen(data.id);
            }
          }}
          className="shrink-0 border-2 border-transparent hover:border-black focus-visible:ring-2 focus-visible:ring-sky-600 py-2 px-3 text-sm bg-white text-neutral-950 rounded-md shadow-sm"
        >
          {data.labels.length > 0 && (
            <div
              className="flex flex-wrap gap-1 mb-1.5"
              aria-label={`Labels: ${data.labels.map((cl) => cl.label.name).join(", ")}`}
            >
              {data.labels.map((cardLabel) => (
                <span
                  key={cardLabel.id}
                  className="inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-neutral-900"
                  style={{ backgroundColor: `${cardLabel.label.color}26` }}
                >
                  <span
                    aria-hidden="true"
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: cardLabel.label.color }}
                  />
                  <span className="truncate">{cardLabel.label.name}</span>
                </span>
              ))}
            </div>
          )}
          <p className="line-clamp-2 break-words">{data.title}</p>
          <div className="mt-2 flex items-center gap-2.5 text-xs text-neutral-500">
            {data.description && (
              <span title="Has description" aria-label="Has description">
                <AlignLeft aria-hidden="true" className="size-3" />
              </span>
            )}
            {data._count.comments > 0 && (
              <span
                className="flex items-center gap-1"
                aria-label={`${data._count.comments} comments`}
              >
                <MessageSquare aria-hidden="true" className="size-3" />
                {data._count.comments}
              </span>
            )}
            <time
              className="ml-auto"
              dateTime={new Date(data.updatedAt).toISOString()}
              title={`Updated ${new Date(data.updatedAt).toLocaleString()}`}
              suppressHydrationWarning
            >
              {formatDistanceToNowStrict(data.updatedAt).replace(
                / (second|minute|hour|day|month|year)s?$/,
                (_, unit: string) => (unit === "month" ? "mo" : unit[0]),
              )}
            </time>
            {(data.creatorKind === "AGENT" || initials) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    aria-label={`Created by ${creator}`}
                    className={`flex size-[22px] shrink-0 items-center justify-center text-[10px] font-semibold ${data.creatorKind === "AGENT" ? "rounded-md bg-slate-800 text-white" : "rounded-full bg-emerald-600 text-white"}`}
                  >
                    {data.creatorKind === "AGENT" ? (
                      <Bot aria-hidden="true" className="size-3.5" />
                    ) : (
                      initials
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent>Created by {creator}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
};
