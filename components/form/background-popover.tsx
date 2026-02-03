"use client";

import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAction } from "@/hooks/use-action";
import { updateBoard } from "@/actions/update-board";
import { FormSubmit } from "./form-submit";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { toast } from "sonner";
import { FormPicker } from "./form-picker";
import { useRef } from "react";
import { useRouter } from "next/navigation";

interface BackgroundPopoverProps {
  children: React.ReactNode;
  boardId: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

export const BackgroundPopover = ({
  children,
  boardId,
  side = "bottom",
  align,
  sideOffset = 0,
}: BackgroundPopoverProps) => {
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);

  const { execute, fieldErrors } = useAction(updateBoard, {
    onSuccess: (data) => {
      toast.success(`Background updated for "${data.title}"`);
      closeRef.current?.click();
      router.refresh();
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const onSubmit = (formData: FormData) => {
    const image = formData.get("image") as string;

    if (!image) {
      toast.error("Please select an image");
      return;
    }

    execute({ id: boardId, image });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-80 pt-3"
        side={side}
        sideOffset={sideOffset}
      >
        <div className="text-sm font-medium text-center text-neutral-600 pb-4">
          Change background
        </div>
        <PopoverClose asChild ref={closeRef}>
          <Button
            className="h-auto w-auto p-2 absolute top-2 right-2 text-neutral-600"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </PopoverClose>
        <form action={onSubmit} className="space-y-4">
          <FormPicker id="image" errors={fieldErrors} />
          <FormSubmit className="w-full">Update background</FormSubmit>
        </form>
      </PopoverContent>
    </Popover>
  );
};
