"use client";

import { ActivityItem } from "@/components/activity-item";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditLog } from "@prisma/client";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

interface ActivityProps {
  items: AuditLog[];
}

export const Activity = ({ items }: ActivityProps) => {
  return (
    <Accordion type="single" collapsible className="border-t">
      <AccordionItem value="activity">
        <AccordionTrigger className="py-3 text-neutral-700">Activity</AccordionTrigger>
        <AccordionContent>
          <ol className="space-y-4">
            {items.map((item) => <ActivityItem key={item.id} data={item} actorBadge={null} />)}
          </ol>
          {items.length === 0 && <p className="text-muted-foreground">No activity yet.</p>}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

Activity.Skeleton = function ActivitySkeleton() {
  return (
    <div className="flex items-start gap-x-3 w-full">
      <Skeleton className="h-6 w-6 bg-neutral-200" />
      <div className="w-full">
        <Skeleton className="h-6 w-24 mb-2 bg-neutral-200" />
        <Skeleton className="h-10 w-full bg-neutral-200" />
      </div>
    </div>
  );
};
