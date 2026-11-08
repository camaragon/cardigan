"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ListWithCards } from "@/types";
import { ListForm } from "./list-form";
import { useEffect, useState, useRef, useTransition } from "react";
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
  const router = useRouter();
  const snapshot = useRef<ListWithCards[] | null>(null);
  const observedDrag = useRef<{ id: string; version: number } | null>(null);
  const [moveConflict, setMoveConflict] = useState<string | null>(null);
  const [isOrdering, startOrdering] = useTransition();
  const [optimisticData, setOrderedData] = useState<ListWithCards[]>(data);

  const orderedData = isOrdering ? optimisticData : data;

  const [filters, setFilters] = useState(emptyBoardFilters);
  const filtering = hasBoardFilters(filters);
  const visibleData = orderedData.map((list) => ({
    ...list,
    cards: list.cards.filter((card) => matchesBoardFilters(card, filters)),
  }));

  useEffect(() => {
    if (!isOrdering) snapshot.current = null;
  }, [isOrdering]);

  const submitOrder = (next: ListWithCards[], execute: () => Promise<unknown>) => {
    // The ref also blocks a second drop before React renders the pending state.
    if (snapshot.current) return;
    snapshot.current = orderedData;
    setOrderedData(next);
    startOrdering(async () => {
      await execute();
      router.refresh();
    });
  };

  const rollback = (error: string) => {
    if (snapshot.current) setOrderedData(snapshot.current);
    toast.error(error);
  };

  const { execute: executeUpdateListOrder } = useAction(updateListOrder, {
    onSuccess: () => {
      toast.success("List reordered");
    },
    onError: rollback,
  });

  const { execute: executeMoveCard } = useAction(moveCard, {
    onSuccess: () => {
      setMoveConflict(null);
      toast.success("Card moved");
    },
    onError: rollback,
  });

  const handleCardMove = (
    cardId: string,
    source: DraggableLocation,
    destination: DraggableLocation,
  ) => {
    // Keep the pre-drag snapshot intact for a rejected move.
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

    if (!sourceList || !destinationList || observedDrag.current?.id !== cardId) return;

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

    // One drag is one audited single-card move (PRD C-6).
    const version = observedDrag.current.version;
    submitOrder(newOrderedData, async () => {
      const result = await executeMoveCard({
        id: movedCard.id,
        boardId,
        toListId: destinationList.id,
        position,
        version,
      });
      if (result?.domainError?.type === "stale_version") {
        setMoveConflict(`“${movedCard.title}” changed. Your move to “${destinationList.title}” was not applied. Reload the board to compare, then try the move again.`);
      }
    });
  };

  const handleListReorder = (
    source: DraggableLocation,
    destination: DraggableLocation,
  ) => {
    const lists = reorder(orderedData, source.index, destination.index).map(
      (list, index) => ({ ...list, order: index }),
    );

    submitOrder(lists, () => executeUpdateListOrder({ boardId, lists }));
  };

  const onDragEnd = ({ draggableId, destination, source, type }: DropResult) => {
    if (!destination || snapshot.current) return;

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
      {moveConflict && (
        <div role="alert" className="mb-3 w-fit rounded-md bg-amber-50 p-3 text-sm text-neutral-800">
          <p>{moveConflict}</p>
          <Button size="sm" variant="outline" onClick={() => router.refresh()}>Reload board</Button>
        </div>
      )}
      <DragDropContext onBeforeCapture={({ draggableId }) => {
        const card = orderedData.flatMap((list) => list.cards).find((card) => card.id === draggableId);
        observedDrag.current = card ? { id: card.id, version: card.version } : null;
      }} onDragEnd={onDragEnd}>
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
                  isOrdering={isOrdering}
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
