"use client";

import { FormSubmit } from "@/components/form/form-submit";
import { FormTextarea } from "@/components/form/form-textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CardWithList } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { RefObject, useEffect, useRef, useState } from "react";
import { useEventListener, useOnClickOutside } from "usehooks-ts";
import { useAction } from "@/hooks/use-action";
import { updateCard } from "@/actions/update-card";
import { toast } from "sonner";

interface DescriptionProps {
  data: CardWithList;
}

export const Description = ({ data }: DescriptionProps) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const [isEditing, setIsEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const previewRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview || expanded) return;
    const observer = new ResizeObserver(() => {
      setIsClamped(preview.scrollHeight > preview.clientHeight);
    });
    observer.observe(preview);
    return () => observer.disconnect();
  }, [data.description, isEditing, expanded]);

  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const enableEditing = () => {
    setIsEditing(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    });
  };

  const disableEditing = () => {
    setIsEditing(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      disableEditing();
    }
  };

  useEventListener("keydown", onKeyDown);
  useOnClickOutside(formRef as RefObject<HTMLFormElement>, disableEditing);

  const { execute, fieldErrors } = useAction(updateCard, {
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["card", data.id],
      });
      queryClient.invalidateQueries({ queryKey: ["card-logs", data.id] });
      toast.success(`Card description updated`);
      disableEditing();
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const onSubmit = (formData: FormData) => {
    const description = formData.get("description") as string;
    const boardId = params.boardId as string;

    execute({
      id: data.id,
      boardId,
      description,
    });
  };

  return (
    <div className="flex items-start gap-x-3 w-full">
      <div className="w-full">
        <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-neutral-700">Description</h3>
          {!isEditing && (isClamped || expanded) && (
            <Button variant="ghost" size="sm" className="h-7" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
              {expanded ? "Show less" : "Show full description"}
            </Button>
          )}
        </div>
        {isEditing ? (
          <form action={onSubmit} ref={formRef}>
            <FormTextarea
              id="description"
              label="Edit description"
              className="w-full mt-2 mb-2 min-h-40 [field-sizing:fixed]"
              placeholder="Add a more detailed description"
              defaultValue={data.description ?? undefined}
              errors={fieldErrors}
              ref={textareaRef}
            />
            <div className="flex items-center gap-x-2">
              <FormSubmit>Save</FormSubmit>
              <Button
                type="button"
                onClick={disableEditing}
                size="sm"
                variant="ghost"
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div>
            <button
              type="button"
              onClick={enableEditing}
              aria-label="Edit description"
              className="w-full rounded-md text-left text-sm leading-5 text-neutral-700 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span ref={previewRef} className={`whitespace-pre-wrap ${expanded ? "block" : "line-clamp-6"}`}>
                {data.description || "Add a more detailed description…"}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

Description.Skeleton = function DescriptionSkeleton() {
  return (
    <div className="flex items-start gap-x-3 w-full">
      <Skeleton className="h-6 w-6 bg-neutral-200" />
      <div className="w-full">
        <Skeleton className="h-6 w-24 mb-2 bg-neutral-200" />
        <Skeleton className="w-full h-[78px] bg-neutral-200" />
      </div>
    </div>
  );
};
