import { Label } from "@prisma/client";
import { cn } from "@/lib/utils";

interface LabelBadgeProps {
  label: Label;
  size?: "sm" | "md";
  showName?: boolean;
  className?: string;
}

export const LabelBadge = ({
  label,
  size = "sm",
  showName = false,
  className,
}: LabelBadgeProps) => {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-sm",
        size === "sm" && "h-2 w-10",
        size === "md" && "h-6 px-2",
        className,
      )}
      style={{ backgroundColor: label.color }}
      title={label.name}
      aria-label={label.name}
      role="img"
    >
      {showName && size === "md" && (
        <span className="text-xs font-medium text-white truncate">
          {label.name}
        </span>
      )}
    </div>
  );
};
