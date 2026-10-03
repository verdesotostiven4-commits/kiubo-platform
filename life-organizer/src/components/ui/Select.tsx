"use client";

import {
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Select custom — NO usa <select> nativo.
 * Dropdown con animación, navegación por teclado y cierre al clic externo.
 */
export function Select({
  value,
  options,
  onChange,
  placeholder = "Selecciona…",
  className,
  disabled,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value);

  // Cierra al clicar fuera.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Reset highlight al abrir.
  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setHighlighted(idx >= 0 ? idx : 0);
    }
  }, [open, options, value]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        break;
      case "ArrowDown":
        e.preventDefault();
        setHighlighted((h) => Math.min(h + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (options[highlighted]) {
          onChange(options[highlighted].value);
          setOpen(false);
          buttonRef.current?.focus();
        }
        break;
    }
  };

  return (
    <div
      ref={ref}
      className={cn("relative", className)}
      onKeyDown={onKeyDown}
    >
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full h-10 px-3 flex items-center justify-between gap-2",
          "rounded-xl border text-sm transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-lavanda-400",
          open
            ? "border-lavanda-400 ring-2 ring-lavanda-400/20"
            : "border-lila-200 hover:border-lila-300",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <span className={cn("truncate", !selected && "text-lila-400")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-lila-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-30 mt-1 w-full min-w-full",
            "rounded-xl border border-lila-100 bg-white shadow-lg",
            "py-1 max-h-60 overflow-y-auto",
          )}
          role="listbox"
        >
          {options.map((opt, i) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
                buttonRef.current?.focus();
              }}
              onMouseEnter={() => setHighlighted(i)}
              className={cn(
                "w-full px-3 py-2 flex items-center justify-between gap-2 text-left text-sm transition-colors",
                i === highlighted && "bg-lila-50",
                opt.value === value
                  ? "text-lavanda-700 font-medium"
                  : "text-lila-700",
              )}
            >
              <span className="truncate">{opt.label}</span>
              {opt.value === value && (
                <Check className="h-4 w-4 shrink-0 text-lavanda-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Re-export para conveniencia cuando se necesita como children.
export type { ReactNode };
