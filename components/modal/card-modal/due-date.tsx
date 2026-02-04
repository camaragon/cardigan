"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { CardWithListAndLabels } from "@/types";
import { Calendar, X } from "lucide-react";
import { useAction } from "@/hooks/use-action";
import { updateCard } from "@/actions/update-card";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { useState } from "react";

interface DueDateProps {
  data: CardWithListAndLabels;
}

function formatDueDate(date: Date): string {
  if (isToday(date)) return `Today, ${format(date, "h:mm a")}`;
  if (isTomorrow(date)) return `Tomorrow, ${format(date, "h:mm a")}`;
  return format(date, "MMM d, yyyy");
}

function getDueDateColor(date: Date): string {
  if (isPast(date) && !isToday(date)) return "text-red-600 bg-red-50";
  if (isToday(date)) return "text-orange-600 bg-orange-50";
  if (isTomorrow(date)) return "text-yellow-600 bg-yellow-50";
  return "text-neutral-600 bg-neutral-100";
}

export const DueDate = ({ data }: DueDateProps) => {
  const params = useParams();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const { execute, isLoading } = useAction(updateCard, {
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["card", result.id] });
      queryClient.invalidateQueries({ queryKey: ["card-logs", result.id] });
      toast.success("Due date updated");
      setIsOpen(false);
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const onSetDate = (dateStr: string) => {
    const boardId = params.boardId as string;
    const date = new Date(dateStr);
    execute({
      id: data.id,
      boardId,
      dueDate: date.toISOString(),
    });
  };

  const onClear = () => {
    const boardId = params.boardId as string;
    execute({
      id: data.id,
      boardId,
      dueDate: null,
    });
  };

  const dueDate = data.dueDate ? new Date(data.dueDate) : null;

  return (
    <div className="flex items-start gap-x-3 w-full">
      <Calendar className="h-5 w-5 mt-0.5 text-neutral-700" />
      <div className="w-full">
        <p className="font-semibold text-neutral-700 mb-2">Due Date</p>
        <div className="flex items-center gap-2">
          {dueDate && (
            <span
              className={`text-sm font-medium px-2 py-1 rounded ${getDueDateColor(dueDate)}`}
            >
              {formatDueDate(dueDate)}
            </span>
          )}
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              {dueDate ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={isLoading}
                >
                  Change
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-neutral-500"
                  disabled={isLoading}
                >
                  Set due date
                </Button>
              )}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <div className="space-y-2">
                <p className="text-sm font-medium">Set due date</p>
                <input
                  type="date"
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
                  defaultValue={
                    dueDate ? format(dueDate, "yyyy-MM-dd") : undefined
                  }
                  onChange={(e) => {
                    if (e.target.value) onSetDate(e.target.value);
                  }}
                  disabled={isLoading}
                />
              </div>
            </PopoverContent>
          </Popover>
          {dueDate && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-neutral-400 hover:text-red-500"
              onClick={onClear}
              disabled={isLoading}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

DueDate.Skeleton = function DueDateSkeleton() {
  return (
    <div className="flex items-start gap-x-3 w-full">
      <Skeleton className="h-6 w-6 bg-neutral-200" />
      <div className="w-full">
        <Skeleton className="h-6 w-24 mb-2 bg-neutral-200" />
        <Skeleton className="h-7 w-32 bg-neutral-200" />
      </div>
    </div>
  );
};
