import { Card, CardLabel, Label, List } from "@prisma/client";

export type ListWithCards = List & {
  cards: (CardWithLabels & { _count: { comments: number } })[];
};

export type CardWithList = Card & { list: List };

export type CardWithLabels = Card & {
  labels: (CardLabel & { label: Label })[];
};

export type CardWithListAndLabels = Card & {
  list: List;
  labels: (CardLabel & { label: Label })[];
};
