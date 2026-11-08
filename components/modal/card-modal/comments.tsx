"use client";

import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Comment } from "@prisma/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { addComment } from "@/actions/add-comment";
import { Button } from "@/components/ui/button";
import { FormSubmit } from "@/components/form/form-submit";
import { FormTextarea } from "@/components/form/form-textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAction } from "@/hooks/use-action";

interface CommentsProps {
  items: Comment[];
}

export const Comments = ({ items }: CommentsProps) => {
  const [showEarlier, setShowEarlier] = useState(false);
  const visible = showEarlier ? items : items.slice(-3);
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-700">Comments</h3>
        {items.length > 3 && (
          <Button variant="ghost" size="sm" onClick={() => setShowEarlier(!showEarlier)} aria-expanded={showEarlier}>
            {showEarlier ? "Hide earlier comments" : `Show ${items.length - 3} earlier comments`}
          </Button>
        )}
      </div>
      {items.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
      <ol className="space-y-3">
        {visible.map((comment) => (
          <li key={comment.id} className="text-sm">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-neutral-700">{comment.actorName}</span>{" · "}
              {format(new Date(comment.createdAt), "MMM d, h:mm a")}
              {comment.kind === "DUPLICATE" && " · marked a duplicate"}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-neutral-700">{comment.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
};

export const CommentForm = ({ cardId }: { cardId: string }) => {
  const params = useParams();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);

  const { execute, fieldErrors } = useAction(addComment, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card-comments", cardId] });
      queryClient.invalidateQueries({ queryKey: ["card-logs", cardId] });
      formRef.current?.reset();
    },
    onError: (error) => toast.error(error),
  });

  const onSubmit = (formData: FormData) => {
    execute({
      cardId,
      boardId: params.boardId as string,
      body: formData.get("body") as string,
    });
  };

  return (
    <form ref={formRef} action={onSubmit} className="flex items-end gap-3">
      <label htmlFor="body" className="sr-only">Comment</label>
      <FormTextarea
        id="body"
        className="h-16 [field-sizing:fixed] w-full"
        placeholder="Write a comment…"
        errors={fieldErrors}
      />
      <FormSubmit>Comment</FormSubmit>
    </form>
  );
};

Comments.Skeleton = function CommentsSkeleton() {
  return (
    <div className="flex items-start gap-x-3 w-full">
      <Skeleton className="h-6 w-6 bg-neutral-200" />
      <div className="w-full">
        <Skeleton className="h-6 w-24 mb-2 bg-neutral-200" />
        <Skeleton className="h-16 w-full bg-neutral-200" />
      </div>
    </div>
  );
};
