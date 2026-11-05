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

  const handleCardMove = async (
    source: DraggableLocation,
    destination: DraggableLocation,
  ) => {
    const previous = orderedData;
    const next = orderedData.map((list) => ({
      ...list,
      cards: list.cards.map((card) => ({ ...card })),
    }));
    const sourceList = next.find((list) => list.id === source.droppableId);
    const destinationList = next.find(
      (list) => list.id === destination.droppableId,
    );
    if (!sourceList || !destinationList) return;

    const [movedCard] = sourceList.cards.splice(source.index, 1);
    destinationList.cards.splice(destination.index, 0, {
      ...movedCard,
      listId: destinationList.id,
    });
    sourceList.cards.forEach((card, index) => (card.order = index));
    destinationList.cards.forEach((card, index) => (card.order = index));
    setOrderedData(next);

    // One drag is one audited single-card move; a move the list rules
    // refuse snaps back.
    const result = await moveCard({
      id: movedCard.id,
      boardId,
      toListId: destinationList.id,
      position: destination.index,
    });
    if (result.error || result.fieldErrors) {
      setOrderedData(previous);
      toast.error(result.error ?? "Failed to move card");
      return;
    }
    toast.success(
      source.droppableId === destination.droppableId
        ? "Card reordered"
        : `Moved to ${destinationList.title}`,
    );
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
      void handleCardMove(source, destination);
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
