"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-lavanda-600 text-white hover:bg-lavanda-700 active:bg-lavanda-800 shadow-sm",
  secondary:
    "bg-white text-lila-900 border border-lila-200 hover:bg-lila-50 active:bg-lila-100",
  ghost:
    "bg-transparent text-lila-700 hover:bg-lila-50 active:bg-lila-100",
  danger:
    "bg-rose-500 text-white hover:bg-rose-600 active:bg-rose-700 shadow-sm",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-12 px-6 text-base rounded-xl gap-2",
  icon: "h-9 w-9 rounded-lg justify-center",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center font-medium transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lavanda-400 focus-visible:ring-offset-1",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          VARIANTS[variant],
          SIZES[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
