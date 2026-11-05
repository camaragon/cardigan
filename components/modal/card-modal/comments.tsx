"use client";

import { useRef } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Comment } from "@prisma/client";
import { format } from "date-fns";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { addComment } from "@/actions/add-comment";
import { ActorBadge } from "@/components/actor-badge";
import { FormSubmit } from "@/components/form/form-submit";
import { FormTextarea } from "@/components/form/form-textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAction } from "@/hooks/use-action";

interface CommentsProps {
  cardId: string;
  items: Comment[];
}

export const Comments = ({ cardId, items }: CommentsProps) => {
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
    <div className="flex items-start gap-x-3 w-full">
      <MessageSquare className="h-5 w-5 mt-0.5 text-neutral-700" />
      <div className="w-full">
        <p className="font-semibold text-neutral-700 mb-2">Comments</p>
        <ol className="space-y-3 mb-3">
          {items.map((comment) => (
            <li key={comment.id} className="text-sm">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-neutral-700">
                  {comment.actorName}
                </span>{" "}
                <ActorBadge kind={comment.actorKind} />{" "}
                {comment.kind === "DUPLICATE" && "marked a duplicate · "}
                {format(new Date(comment.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
              <p className="whitespace-pre-wrap text-neutral-700">{comment.body}</p>
            </li>
          ))}
        </ol>
        <form ref={formRef} action={onSubmit} className="space-y-2">
          <FormTextarea
            id="body"
            className="w-full"
            placeholder="Write a comment..."
            errors={fieldErrors}
          />
          <FormSubmit>Comment</FormSubmit>
        </form>
      </div>
    </div>
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
