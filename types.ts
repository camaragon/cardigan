import { Card, CardLabel, Label, List } from "@prisma/client";

export type ListWithCards = List & {
  cards: (CardWithLabels & { _count: { comments: number; blockedBy: number } })[];
};

export type CardWithList = Card & { list: List; key?: string | null };

export type CardWithLabels = Card & {
  key?: string | null;
  keyAliases?: string[];
  labels: (CardLabel & { label: Label })[];
};

export type CardWithListAndLabels = Card & {
  key?: string | null;
  list: List;
  labels: (CardLabel & { label: Label })[];
  blockedBy: { blockerId: string; blocker: { id: string; title: string } }[];
};
