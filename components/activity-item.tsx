import { ReactNode } from "react";
import { ActorBadge } from "@/components/actor-badge";
import { AuditLog } from "@prisma/client";
import { generateLogMessages } from "@/lib/generate-log-messages";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";

interface ActivityItemProps {
  data: AuditLog;
  actorBadge?: ReactNode;
}

export const ActivityItem = ({
  data,
  actorBadge = <ActorBadge kind={data.actorKind} />,
}: ActivityItemProps) => {
  return (
    <li className="flex items-center gap-x-2">
      <Avatar className="h-8 w-8">
        <AvatarImage src={data.userImage} alt="" />
        <AvatarFallback className="text-xs">{data.userName.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex flex-col space-y-0.5 break-words">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-neutral-700">
            {data.userName}
          </span>{" "}
          {actorBadge}{" "}
          {generateLogMessages(data)}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(data.createdAt), "MMM d, yyyy 'at' h:mm a")}
        </p>
      </div>
    </li>
  );
};
