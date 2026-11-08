"use client";

import { ListWithCards } from "@/types";
import { ListHeader } from "./list-header";
import { useRef, useState } from "react";
import { CardForm } from "./card-form";
import { cn } from "@/lib/utils";
import { CardItem } from "./card-item";
import { Draggable, Droppable } from "@hello-pangea/dnd";

interface ListItemProps {
  data: ListWithCards;
  index: number;
  filtering?: boolean;
}

export const ListItem = ({ data, index, filtering = false }: ListItemProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isEditing, setIsEditing] = useState(false);

  const disableEditing = () => {
    setIsEditing(false);
  };

  const enableEditing = () => {
    setIsEditing(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    });
  };

  return (
    <Draggable draggableId={data.id} index={index} isDragDisabled={filtering}>
      {(provided) => (
        <li
          {...provided.draggableProps}
          ref={provided.innerRef}
          className="shrink-0 w-[272px] select-none"
        >
          <div
            {...provided.dragHandleProps}
            className={cn(
              filtering &&
                "!max-h-[calc(100dvh-14.5rem)] sm:!max-h-[calc(100dvh-12rem)]",
              "flex max-h-[calc(100dvh-12rem)] sm:max-h-[calc(100dvh-9.5rem)] w-full flex-col rounded-md bg-[#f1f2f4] shadow-md pb-2",
            )}
          >
            <ListHeader data={data} onAddCardAction={enableEditing} />
            <Droppable droppableId={data.id} type="card">
              {(provided) => (
                <ol
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={cn(
                    "board-scrollbar min-h-0 overflow-y-auto overscroll-contain mx-1 px-1 py-0.5 flex flex-col gap-y-2 [&>div]:shrink-0",
                    data.cards.length > 0 ? "mt-2" : "mt-0",
                  )}
                >
                  {data.cards.map((card, index) => (
                    <CardItem
                      index={index}
                      key={card.id}
                      data={card}
                    />
                  ))}
                  {provided.placeholder}
                </ol>
              )}
            </Droppable>
            <CardForm
              listId={data.id}
              ref={textareaRef}
              isEditing={isEditing}
              enableEditing={enableEditing}
              disableEditing={disableEditing}
            />
          </div>
        </li>
      )}
    </Draggable>
  );
};
