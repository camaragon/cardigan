"use client";

import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAction } from "@/hooks/use-action";
import { createBoard } from "@/actions/create-board";
import { updateBoard } from "@/actions/update-board";
import { FormInput } from "./form-input";
import { FormSubmit } from "./form-submit";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { toast } from "sonner";
import { FormPicker } from "./form-picker";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useProModal } from "@/hooks/use-pro-modal";

interface FormPopoverProps {
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  mode?: "create" | "update";
  boardId?: string;
}

export const FormPopover = ({
  children,
  side = "bottom",
  align,
  sideOffset = 0,
  mode = "create",
  boardId,
}: FormPopoverProps) => {
  const proModal = useProModal();
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);

  const { execute: executeCreate, fieldErrors: createErrors } = useAction(
    createBoard,
    {
      onSuccess: (data) => {
        toast.success("Board created!");
        closeRef.current?.click();
        router.push(`/board/${data.id}`);
      },
      onError: (error) => {
        toast.error(error);
        proModal.onOpen();
      },
    }
  );

  const { execute: executeUpdate, fieldErrors: updateErrors } = useAction(
    updateBoard,
    {
      onSuccess: (data) => {
        toast.success(`Background updated for "${data.title}"`);
        closeRef.current?.click();
        router.refresh();
      },
      onError: (error) => {
        toast.error(error);
      },
    }
  );

  const fieldErrors = mode === "create" ? createErrors : updateErrors;

  const onSubmit = (formData: FormData) => {
    const image = formData.get("image") as string;

    if (!image) {
      toast.error("Please select an image");
      return;
    }

    if (mode === "create") {
      const title = formData.get("title") as string;
      executeCreate({ title, image });
    } else {
      if (!boardId) {
        toast.error("Board ID is required for update");
        return;
      }
      executeUpdate({ id: boardId, image });
    }
  };

  const isCreateMode = mode === "create";

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
          {isCreateMode ? "Create board" : "Change background"}
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
          <div className="space-y-4">
            <FormPicker id="image" errors={fieldErrors} />
            {isCreateMode && (
              <FormInput
                id="title"
                label="Board title"
                type="text"
                errors={fieldErrors}
              />
            )}
          </div>
          <FormSubmit className="w-full">
            {isCreateMode ? "Create" : "Update background"}
          </FormSubmit>
        </form>
      </PopoverContent>
    </Popover>
  );
};
