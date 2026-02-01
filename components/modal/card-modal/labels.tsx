"use client";

import { LabelBadge } from "@/components/ui/label-badge";
import { LabelPicker } from "@/components/form/label-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { CardWithListAndLabels } from "@/types";
import { Tags } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LabelsProps {
  data: CardWithListAndLabels;
}

export const Labels = ({ data }: LabelsProps) => {
  return (
    <div className="flex items-start gap-x-3 w-full">
      <Tags className="h-5 w-5 mt-0.5 text-neutral-700" />
      <div className="w-full">
        <p className="font-semibold text-neutral-700 mb-2">Labels</p>
        <div className="flex flex-wrap gap-1 items-center">
          {data.labels.map((cardLabel) => (
            <LabelBadge
              key={cardLabel.id}
              label={cardLabel.label}
              size="md"
              showName
            />
          ))}
          <LabelPicker
            cardId={data.id}
            assignedLabels={data.labels}
          >
            <Button variant="ghost" size="sm" className="h-6 text-xs">
              +
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
