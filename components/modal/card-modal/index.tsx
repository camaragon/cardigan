"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useCardModal } from "@/hooks/use-card-modal";
import { FetchError, fetcher } from "@/lib/fetcher";
import { CardWithListAndLabels } from "@/types";
import { skipToken, useQuery } from "@tanstack/react-query";
import { Header } from "./header";
import { Description } from "./description";
import { Actions } from "./actions";
import { AuditLog, Comment } from "@prisma/client";
import { Activity } from "./activity";
import { Labels } from "./labels";
import { Comments, CommentForm } from "./comments";

import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

const ReadError = ({ message, retry, children }: {
  message: string;
  retry: () => void;
  children?: ReactNode;
}) => (
  <section role="alert" className="space-y-3 p-6">
    <p className="text-sm text-muted-foreground">{message}</p>
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={retry}>Retry</Button>
      {children}
    </div>
  </section>
);

export const CardModal = () => {
  const id = useCardModal((state) => state.id);
  const isOpen = useCardModal((state) => state.isOpen);
  const onClose = useCardModal((state) => state.onClose);

  const enabled = isOpen && !!id;
  const card = useQuery<CardWithListAndLabels | null>({
    queryKey: ["card", id],
    queryFn: id ? () => fetcher(`/api/cards/${id}`) : skipToken,
    enabled,
    retry: false,
  });
  const cardData = card.data;
  const relatedEnabled = enabled && card.isSuccess && !!cardData;

  const logs = useQuery<AuditLog[]>({
    queryKey: ["card-logs", id],
    queryFn: id ? () => fetcher(`/api/cards/${id}/logs`) : skipToken,
    enabled: relatedEnabled,
    retry: false,
  });

  const comments = useQuery<Comment[]>({
    queryKey: ["card-comments", id],
    queryFn: id ? () => fetcher(`/api/cards/${id}/comments`) : skipToken,
    enabled: relatedEnabled,
    retry: false,
  });

  const status = card.error instanceof FetchError ? card.error.status : undefined;
  const missing = status === 404 || (card.isSuccess && !cardData);
  const readError = !id ? "No card selected" : missing ? "Card not found"
    : status === 401 ? "Sign-in required" : card.isError ? "Unable to load card" : null;

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
        {readError ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <h2 className="px-6 pt-6 font-semibold">{readError}</h2>
            <ReadError
              message={missing ? "This card was deleted or is unavailable in this workspace."
                : status === 401 ? "Sign in again, then retry."
                : "The card could not be loaded. Please try again."}
              retry={() => { if (enabled) void card.refetch(); }}
            >
              <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
            </ReadError>
          </div>
        ) : (
          <>
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
              {comments.isError ? (
                <ReadError message="Unable to load comments." retry={() => { void comments.refetch(); }} />
              ) : !comments.data ? <Comments.Skeleton /> : <Comments items={comments.data} />}
              {logs.isError ? (
                <ReadError message="Unable to load activity." retry={() => { void logs.refetch(); }} />
              ) : !logs.data ? <Activity.Skeleton /> : <Activity items={logs.data} />}
            </div>
            <footer className="shrink-0 border-t px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {cardData && id && <CommentForm key={id} cardId={id} />}
            </footer>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
