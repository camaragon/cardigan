"use client";

import { Card, CardLabel, Label } from "@prisma/client";
import { Draggable } from "@hello-pangea/dnd";
import { useCardModal } from "@/hooks/use-card-modal";
import { LabelBadge } from "@/components/ui/label-badge";

interface CardItemProps {
  data: Card & { labels: (CardLabel & { label: Label })[] };
  index: number;
}

export const CardItem = ({ data, index }: CardItemProps) => {
  const cardModal = useCardModal();

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
        </div>
      )}
    </Draggable>
  );
};
