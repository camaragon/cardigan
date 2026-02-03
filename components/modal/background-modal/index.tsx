"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormPicker } from "@/components/form/form-picker";
import { FormSubmit } from "@/components/form/form-submit";
import { useAction } from "@/hooks/use-action";
import { updateBoard } from "@/actions/update-board";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useBackgroundModal } from "@/hooks/use-background-modal";

export const BackgroundModal = () => {
  const router = useRouter();
  const backgroundModal = useBackgroundModal();
  const boardId = backgroundModal.boardId;

  const { execute, fieldErrors, isLoading } = useAction(updateBoard, {
    onSuccess: (data) => {
      toast.success(`Background updated for "${data.title}"`);
      backgroundModal.onClose();
      router.refresh();
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const onSubmit = (formData: FormData) => {
    const image = formData.get("image") as string;

    if (!boardId) {
      toast.error("No board selected");
      return;
    }

    if (!image) {
      toast.error("Please select an image");
      return;
    }

    execute({ id: boardId, image });
  };

  return (
    <Dialog open={backgroundModal.isOpen} onOpenChange={backgroundModal.onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change background</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <FormPicker id="image" errors={fieldErrors} />
          <FormSubmit className="w-full" disabled={isLoading}>
            {isLoading ? "Updating..." : "Update background"}
          </FormSubmit>
        </form>
      </DialogContent>
    </Dialog>
  );
};
