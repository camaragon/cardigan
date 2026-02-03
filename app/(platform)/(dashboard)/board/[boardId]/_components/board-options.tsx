"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Image, MoreHorizontal, X } from "lucide-react";
import { deleteBoard } from "@/actions/delete-board/index";
import { useAction } from "@/hooks/use-action";
import { toast } from "sonner";
import { useBackgroundModal } from "@/hooks/use-background-modal";

interface BoardOptionsProps {
  id: string;
}

export const BoardOptions = ({ id }: BoardOptionsProps) => {
  const backgroundModal = useBackgroundModal();

  const { execute, isLoading } = useAction(deleteBoard, {
    onError: (error) => {
      toast.error(error);
    },
  });

  const onDelete = () => {
    execute({ id });
  };

  const onChangeBackground = () => {
    backgroundModal.onOpen(id);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="h-auto w-auto p-2" variant="transparent">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="px-0 pt-3 pb-3" side="bottom" align="start">
        <div className="text-sm font-medium text-center text-neutral-600 pb-4">
          Board actions
        </div>
        <PopoverClose asChild>
          <Button
            variant="ghost"
            className="h-auto w-auto p-2 absolute top-2 right-2 text-neutral-600"
          >
            <X className="h-4 w-4" />
          </Button>
        </PopoverClose>
        <PopoverClose asChild>
          <Button
            onClick={onChangeBackground}
            variant="ghost"
            className="rounded-none w-full h-auto p-2 px-5 justify-start font-normal text-sm"
          >
            <Image className="h-4 w-4 mr-2" />
            Change background
          </Button>
        </PopoverClose>
        <Button
          disabled={isLoading}
          onClick={onDelete}
          variant="ghost"
          className="rounded-none w-full h-auto p-2 px-5 justify-start font-normal text-sm"
        >
          Delete board
        </Button>
      </PopoverContent>
    </Popover>
  );
};
