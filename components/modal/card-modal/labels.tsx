"use client";

import { LabelBadge } from "@/components/ui/label-badge";
import { LabelPicker } from "@/components/form/label-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { CardWithListAndLabels } from "@/types";
import { Button } from "@/components/ui/button";

interface LabelsProps {
  data: CardWithListAndLabels;
}

export const Labels = ({ data }: LabelsProps) => {
  return (
    <div className="flex items-start gap-x-3 w-full">
      <div className="w-full">
        <div className="flex gap-1 items-center overflow-x-auto overscroll-contain">
          {data.labels.map((cardLabel) => (
            <LabelBadge
              key={cardLabel.id}
              label={cardLabel.label}
              className="shrink-0"
              size="md"
              showName
            />
          ))}
          <LabelPicker
            cardId={data.id}
            assignedLabels={data.labels}
          >
            <Button variant="ghost" size="sm" className="h-6 shrink-0 text-xs" aria-label="Add label">
              + Label
            </Button>
          </LabelPicker>
        </div>
      </div>
    </div>
  );
};

Labels.Skeleton = function LabelsSkeleton() {
  return (
    <div className="flex items-start gap-x-3 w-full">
      <Skeleton className="h-6 w-6 bg-neutral-200" />
      <div className="w-full">
        <Skeleton className="h-6 w-24 mb-2 bg-neutral-200" />
        <div className="flex gap-1">
          <Skeleton className="h-6 w-16 bg-neutral-200" />
          <Skeleton className="h-6 w-16 bg-neutral-200" />
        </div>
      </div>
    </div>
  );
};
