import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-lila-100 bg-white/80 backdrop-blur-sm",
        "shadow-sm transition-shadow hover:shadow-md",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 px-5 pt-4 pb-3",
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-lila-900 truncate">{title}</h3>
        {subtitle && (
          <p className="text-xs text-lila-500 mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-5 pb-4", className)} {...props} />
  );
}
