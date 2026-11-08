"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useCardModal } from "@/hooks/use-card-modal";
import { fetcher } from "@/lib/fetcher";
import { CardWithListAndLabels } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { Header } from "./header";
import { Description } from "./description";
import { Actions } from "./actions";
import { AuditLog, Comment } from "@prisma/client";
import { Activity } from "./activity";
import { Labels } from "./labels";
import { Comments, CommentForm } from "./comments";

export const CardModal = () => {
  const id = useCardModal((state) => state.id);
  const isOpen = useCardModal((state) => state.isOpen);
  const onClose = useCardModal((state) => state.onClose);

  const { data: cardData } = useQuery<CardWithListAndLabels>({
    queryKey: ["card", id],
    queryFn: () => fetcher(`/api/cards/${id}`),
  });

  const { data: auditLogsData } = useQuery<AuditLog[]>({
    queryKey: ["card-logs", id],
    queryFn: () => fetcher(`/api/cards/${id}/logs`),
  });

  const { data: commentsData } = useQuery<Comment[]>({
    queryKey: ["card-comments", id],
    queryFn: () => fetcher(`/api/cards/${id}/comments`),
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        key={id}
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.target as HTMLElement).querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')?.focus();
        }}
        className="flex h-dvh max-h-dvh w-full max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[680px] sm:max-h-[calc(100dvh-2rem)] sm:w-[720px] sm:max-w-[calc(100vw-2rem)] sm:rounded-xl"
      >
        <VisuallyHidden>
          <DialogTitle>{cardData?.title ?? "Card"}</DialogTitle>
        </VisuallyHidden>
        <header className="relative shrink-0 border-b px-6 pt-6 pb-4">
          {!cardData ? <Header.Skeleton /> : <Header data={cardData} />}
          {!cardData ? <Labels.Skeleton /> : <Labels data={cardData} />}
          {cardData && (
            <div className="absolute top-3 right-12">
              <Actions data={cardData} />
            </div>
          )}
        </header>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 py-4 [overflow-wrap:anywhere]">
          {!cardData ? <Description.Skeleton /> : <Description data={cardData} />}
          {!commentsData ? <Comments.Skeleton /> : <Comments items={commentsData} />}
          {!auditLogsData ? <Activity.Skeleton /> : <Activity items={auditLogsData} />}
        </div>
        <footer className="shrink-0 border-t px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {id && <CommentForm key={id} cardId={id} />}
        </footer>
      </DialogContent>
    </Dialog>
  );
};
