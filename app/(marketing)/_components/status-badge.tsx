import { cn } from "@/lib/utils";

type Status = "available" | "soon";

const styles: Record<Status, string> = {
  available: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  soon: "bg-amber-50 text-amber-800 ring-amber-600/25",
};

const labels: Record<Status, string> = {
  available: "Available now",
  soon: "Coming soon",
};

export const StatusBadge = ({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
      styles[status],
      className,
    )}
  >
    <span
      aria-hidden="true"
      className={cn(
        "size-1.5 rounded-full",
        status === "available" ? "bg-emerald-500" : "bg-amber-500",
      )}
    />
    {labels[status]}
  </span>
);
