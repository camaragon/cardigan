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
import { updateCardOrder } from "@/actions/update-card-order";

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

  const { execute: executeUpdateCardOrder } = useAction(updateCardOrder, {
    onSuccess: () => {
      toast.success("Card reordered");
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const moveCardWithinSameList = (
    list: ListWithCards,
    source: DraggableLocation,
    destination: DraggableLocation,
  ) => {
    const reorderedCards = reorder(list.cards, source.index, destination.index);
    reorderedCards.forEach((card, index) => (card.order = index));
    list.cards = reorderedCards;
    executeUpdateCardOrder({ boardId, cards: list.cards });
  };

  const moveCardToAnotherList = (
    sourceList: ListWithCards,
    destinationList: ListWithCards,
    source: DraggableLocation,
    destination: DraggableLocation,
  ) => {
    const [movedCard] = sourceList.cards.splice(source.index, 1);
    movedCard.listId = destination.droppableId;
    destinationList.cards.splice(destination.index, 0, movedCard);

    sourceList.cards.forEach((card, index) => (card.order = index));
    destinationList.cards.forEach((card, index) => (card.order = index));
    executeUpdateCardOrder({ boardId, cards: destinationList.cards });
  };

  const handleCardReorder = (
    source: DraggableLocation,
    destination: DraggableLocation,
  ) => {
    const newOrderedData = [...orderedData];
    const sourceList = newOrderedData.find(
      (list) => list.id === source.droppableId,
    );
    const destinationList = newOrderedData.find(
      (list) => list.id === destination.droppableId,
    );

    if (!sourceList || !destinationList) return;

    if (source.droppableId === destination.droppableId) {
      moveCardWithinSameList(sourceList, source, destination);
    } else {
      moveCardToAnotherList(sourceList, destinationList, source, destination);
    }

    setOrderedData(newOrderedData);
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
      handleCardReorder(source, destination);
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
