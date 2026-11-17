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
import { KeyPrefixInput } from "./key-prefix-input";
import { FormInput } from "./form-input";
import { FormSubmit } from "./form-submit";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { toast } from "sonner";
import { FormPicker } from "./form-picker";
import { useId, useRef, useState } from "react";
import { BoardTemplateKey, TEMPLATES } from "@/lib/domain/templates";
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
  const templateId = useId();
  const [template, setTemplate] = useState<BoardTemplateKey>("blank");
  const [title, setTitle] = useState("");
  const [prefixDraft, setPrefixDraft] = useState<string | null>(null);
  const suggestion = title.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^[0-9]+/, "").slice(0, 10);
  const keyPrefix = prefixDraft ?? (suggestion.length >= 2 ? suggestion : "DEMO");
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
        if (error.includes("limit of free boards")) proModal.onOpen();
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
      const template = (formData.get("template") ?? "blank") as BoardTemplateKey;
      executeCreate({ title, image, template, keyPrefix: template === "product_management" ? keyPrefix : undefined });
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
    <Popover onOpenChange={open => {
      if (!open) { setTitle(""); setTemplate("blank"); setPrefixDraft(null); }
    }}>
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
                onChange={event => setTitle(event.target.value)}
                type="text"
                errors={fieldErrors}
              />
            )}
            {isCreateMode && (
              <div className="space-y-1">
                <label
                  htmlFor={templateId}
                  className="text-xs font-semibold text-neutral-700"
                >
                  Template
                </label>
                <select
                  id={templateId}
                  name="template"
                  value={template}
                  onChange={event => setTemplate(event.target.value as BoardTemplateKey)}
                  className="block h-8 w-full rounded-md border bg-white px-2 text-sm text-neutral-900 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  {Object.values(TEMPLATES).map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {isCreateMode && template === "product_management" && (
              <KeyPrefixInput value={keyPrefix} onChange={setPrefixDraft} errors={createErrors?.keyPrefix} />
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
