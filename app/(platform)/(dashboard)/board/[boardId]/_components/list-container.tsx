"use client";

import { ListWithCards } from "@/types";
import { ListForm } from "./list-form";
import { useEffect, useState } from "react";
import { ListItem } from "./list-item";
import {
  DragDropContext,
  DraggableLocation,
  Droppable,
  DropResult,
} from "@hello-pangea/dnd";
import { useAction } from "@/hooks/use-action";
import { updateListOrder } from "@/actions/update-list-order";
import { toast } from "sonner";
import { moveCard } from "@/actions/move-card";

interface ListContainerProps {
  boardId: string;
  data: ListWithCards[];
}

const reorder = <T,>(list: T[], startIndex: number, endIndex: number): T[] => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

export const ListContainer = ({ boardId, data }: ListContainerProps) => {
  const [orderedData, setOrderedData] = useState<ListWithCards[]>(data);

  useEffect(() => {
    setOrderedData(data);
  }, [data]);

  const { execute: executeUpdateListOrder } = useAction(updateListOrder, {
    onSuccess: () => {
      toast.success("List reordered");
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const { execute: executeMoveCard } = useAction(moveCard, {
    onSuccess: () => {
      toast.success("Card moved");
    },
    onError: (error) => {
      // Refused: snap back to the order the server sent.
      setOrderedData(data);
      toast.error(error);
    },
  });

  const handleCardMove = (
    source: DraggableLocation,
    destination: DraggableLocation,
  ) => {
    // Copy the lists and cards before splicing so `data` keeps the server's
    // order for a snap-back.
    const newOrderedData = orderedData.map((list) => ({
      ...list,
      cards: [...list.cards],
    }));
    const sourceList = newOrderedData.find(
      (list) => list.id === source.droppableId,
    );
    const destinationList = newOrderedData.find(
      (list) => list.id === destination.droppableId,
    );

    if (!sourceList || !destinationList) return;

    const [movedCard] = sourceList.cards.splice(source.index, 1);
    destinationList.cards.splice(destination.index, 0, {
      ...movedCard,
      listId: destinationList.id,
    });

    setOrderedData(newOrderedData);
    // One drag is one audited single-card move (PRD C-6).
    executeMoveCard({
      id: movedCard.id,
      boardId,
      toListId: destinationList.id,
      position: destination.index,
    });
  };

  const handleListReorder = (
    source: DraggableLocation,
    destination: DraggableLocation,
  ) => {
    const lists = reorder(orderedData, source.index, destination.index).map(
      (list, index) => ({ ...list, order: index }),
    );

    setOrderedData(lists);
    executeUpdateListOrder({ boardId, lists });
  };

  const onDragEnd = ({ destination, source, type }: DropResult) => {
    if (!destination) return;

    const isSamePosition =
      destination.droppableId === source.droppableId &&
      destination.index === source.index;

    if (isSamePosition) return;

    if (type === "list") {
      handleListReorder(source, destination);
    }

    if (type === "card") {
      handleCardMove(source, destination);
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="lists" type="list" direction="horizontal">
        {(provided) => (
          <ol
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="flex gap-x-3 h-full"
          >
            {orderedData.map((list, index) => (
              <ListItem key={list.id} index={index} data={list} />
            ))}
            {provided.placeholder}
            <ListForm />
            <div className="flex-shrink-0 w-1" />
          </ol>
        )}
      </Droppable>
    </DragDropContext>
  );
};
