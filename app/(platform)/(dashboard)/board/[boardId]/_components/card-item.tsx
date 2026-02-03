"use client";

import { Card, CardLabel, Label } from "@prisma/client";
import { Draggable } from "@hello-pangea/dnd";
import { useCardModal } from "@/hooks/use-card-modal";
import { LabelBadge } from "@/components/ui/label-badge";
import { Clock } from "lucide-react";
import { format, isPast, isToday } from "date-fns";

interface CardItemProps {
  data: Card & { labels: (CardLabel & { label: Label })[] };
  index: number;
}

function getDueBadgeClass(date: Date): string {
  if (isPast(date) && !isToday(date)) return "text-red-600 bg-red-50";
  if (isToday(date)) return "text-orange-600 bg-orange-50";
  return "text-neutral-500 bg-neutral-100";
}

export const CardItem = ({ data, index }: CardItemProps) => {
  const cardModal = useCardModal();
  const dueDate = data.dueDate ? new Date(data.dueDate) : null;

  return (
    <Draggable draggableId={data.id} index={index}>
      {(provided) => (
        <div
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          ref={provided.innerRef}
          role="button"
          onClick={() => cardModal.onOpen(data.id)}
          className="border-2 border-transparent hover:border-black focus-visible:ring-2 focus-visible:ring-sky-600 py-2 px-3 text-sm bg-white rounded-md shadow-sm"
        >
          {data.labels.length > 0 && (
            <div
              className="flex flex-wrap gap-1 mb-1.5"
              aria-label={`Labels: ${data.labels.map((cl) => cl.label.name).join(", ")}`}
            >
              {data.labels.map((cardLabel) => (
                <LabelBadge
                  key={cardLabel.id}
                  label={cardLabel.label}
                  size="sm"
                />
              ))}
            </div>
          )}
          <p className="truncate">{data.title}</p>
          {dueDate && (
            <div
              className={`flex items-center gap-1 mt-1.5 text-xs font-medium px-1.5 py-0.5 rounded w-fit ${getDueBadgeClass(dueDate)}`}
            >
              <Clock className="h-3 w-3" />
              {format(dueDate, "MMM d")}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};
