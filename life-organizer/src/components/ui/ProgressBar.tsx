import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
  /** Color del trazo: lavender (default), emerald, amber, rose. */
  tone?: "lavender" | "emerald" | "amber" | "rose";
}

const TONES: Record<NonNullable<ProgressBarProps["tone"]>, string> = {
  lavender: "bg-lavanda-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
};

export function ProgressBar({
  value,
  max = 100,
  className,
  barClassName,
  tone = "lavender",
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      className={cn(
        "h-2 w-full rounded-full bg-lila-100 overflow-hidden",
        className,
      )}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500 ease-out",
          TONES[tone],
          barClassName,
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
