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
import { BoardToolbar } from "./board-toolbar";
import {
  emptyBoardFilters,
  hasBoardFilters,
  matchesBoardFilters,
} from "@/lib/board-filters";
import { moveCard } from "@/actions/move-card";
import { getCardDropPosition } from "@/lib/board-card-order";

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

  const [filters, setFilters] = useState(emptyBoardFilters);
  const filtering = hasBoardFilters(filters);
  const visibleData = orderedData.map((list) => ({
    ...list,
    cards: list.cards.filter((card) => matchesBoardFilters(card, filters)),
  }));

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
    cardId: string,
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

    const sourceIndex = sourceList.cards.findIndex((card) => card.id === cardId);
    if (sourceIndex === -1) return;

    const [movedCard] = sourceList.cards.splice(sourceIndex, 1);
    const position = getCardDropPosition(
      destinationList.cards,
      destinationList.cards.filter((card) => matchesBoardFilters(card, filters)),
      destination.index,
    );
    destinationList.cards.splice(position, 0, {
      ...movedCard,
      listId: destinationList.id,
    });

    setOrderedData(newOrderedData);
    // One drag is one audited single-card move (PRD C-6).
    executeMoveCard({
      id: movedCard.id,
      boardId,
      toListId: destinationList.id,
      position,
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

  const onDragEnd = ({ draggableId, destination, source, type }: DropResult) => {
    if (!destination) return;

    const isSamePosition =
      destination.droppableId === source.droppableId &&
      destination.index === source.index;

    if (isSamePosition) return;

    if (type === "list" && !filtering) {
      handleListReorder(source, destination);
    }

    if (type === "card") {
      handleCardMove(draggableId, source, destination);
    }
  };

  return (
    <>
      <BoardToolbar
        lists={orderedData}
        filters={filters}
        onChange={setFilters}
      />
      {filtering && (
        <p
          role="status"
          className="mb-2 w-fit max-w-[calc(100vw-2rem)] rounded bg-black/60 px-2 py-1 text-xs text-white"
        >
          {visibleData.reduce((total, list) => total + list.cards.length, 0)}{" "}
          matching cards.
        </p>
      )}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="lists" type="list" direction="horizontal">
          {(provided) => (
            <ol
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="flex gap-x-3 h-full"
            >
              {visibleData.map((list, index) => (
                <ListItem
                  key={list.id}
                  index={index}
                  data={list}
                  filtering={filtering}
                />
              ))}
              {provided.placeholder}
              <ListForm />
              <div className="flex-shrink-0 w-1" />
            </ol>
          )}
        </Droppable>
      </DragDropContext>
    </>
  );
};
