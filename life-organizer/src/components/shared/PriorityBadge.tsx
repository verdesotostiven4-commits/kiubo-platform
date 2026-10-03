import { PRIORITY_META, type Priority } from "@/types/domain";
import { cn } from "@/lib/utils";

interface PriorityBadgeProps {
  priority: Priority;
  /** 'badge' = píldora con borde (default). 'dot' = punto + texto. 'solid' = píldora sólida. */
  variant?: "badge" | "dot" | "solid";
  className?: string;
}

export function PriorityBadge({
  priority,
  variant = "badge",
  className,
}: PriorityBadgeProps) {
  const meta = PRIORITY_META[priority];

  if (variant === "dot") {
    return (
      <span
        className={cn("inline-flex items-center gap-1.5 text-xs", className)}
      >
        <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
        <span className="text-lila-600">{meta.label}</span>
      </span>
    );
  }

  if (variant === "solid") {
    return (
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold",
          meta.solid,
          className,
        )}
      >
        P{priority} · {meta.label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
        meta.badge,
        className,
      )}
    >
      P{priority} · {meta.label}
    </span>
  );
}
