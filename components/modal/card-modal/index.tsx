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
import { Comments } from "./comments";

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
      <DialogContent className="max-w-3xl w-full">
        <VisuallyHidden>
          <DialogTitle>{cardData?.title ?? "Card"}</DialogTitle>
        </VisuallyHidden>
        {!cardData ? <Header.Skeleton /> : <Header data={cardData} />}
        <div className="grid grid-cols-1 md:grid-cols-4 md:gap-4">
          <div className="col-span-3">
            <div className="w-full space-y-6">
              {!cardData ? Labels.Skeleton() : <Labels data={cardData} />}
              {!cardData ? (
                Description.Skeleton()
              ) : (
                <Description data={cardData} />
              )}
              {!commentsData || !id ? (
                Comments.Skeleton()
              ) : (
                <Comments cardId={id} items={commentsData} />
              )}
              {!auditLogsData ? (
                Activity.Skeleton()
              ) : (
                <Activity items={auditLogsData} />
              )}
            </div>
          </div>
          {!cardData ? <Actions.Skeleton /> : <Actions data={cardData} />}
        </div>
      </DialogContent>
    </Dialog>
  );
};
