"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  toISODate,
  parseISO,
  monthGrid,
  weekday,
  formatLong,
  MONTHS_ES,
} from "@/lib/dates";

interface DatePickerProps {
  value: string; // ISO YYYY-MM-DD
  onChange: (iso: string) => void;
  minDate?: string;
  maxDate?: string;
  className?: string;
}

const WEEKDAY_HEADERS = ["L", "M", "X", "J", "V", "S", "D"];

/**
 * DatePicker custom — NO usa <input type="date"> nativo.
 * Grilla de calendario mensual con navegación y selección por clic.
 */
export function DatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  className,
}: DatePickerProps) {
  const selected = value ? parseISO(value) : new Date();

  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  const cells = useMemo(
    () => monthGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const today = toISODate();

  const goPrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNext = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const isDisabled = (iso: string | null): boolean => {
    if (!iso) return true;
    if (minDate && iso < minDate) return true;
    if (maxDate && iso > maxDate) return true;
    return false;
  };

  return (
    <div className={cn("inline-block select-none", className)}>
      {/* Header de navegación */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={goPrev}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-lila-500 hover:bg-lila-50 transition-colors"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-lila-900 capitalize">
          {MONTHS_ES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={goNext}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-lila-500 hover:bg-lila-50 transition-colors"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Cabecera de días */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_HEADERS.map((d, i) => (
          <div
            key={i}
            className="h-7 flex items-center justify-center text-xs font-medium text-lila-400"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grilla de días */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((iso, i) => {
          if (!iso) {
            return <div key={i} className="h-9" />;
          }
          const isToday = iso === today;
          const isSelected = iso === value;
          const disabled = isDisabled(iso);
          const isWeekend = weekday(iso) >= 6;

          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onChange(iso)}
              className={cn(
                "h-9 w-9 flex items-center justify-center rounded-lg text-sm transition-all",
                "focus:outline-none focus:ring-2 focus:ring-lavanda-400",
                disabled && "opacity-30 cursor-not-allowed",
                !disabled && !isSelected && "hover:bg-lila-50",
                !isSelected && isWeekend && "text-lila-400",
                !isSelected && !isWeekend && "text-lila-700",
                isSelected
                  ? "bg-lavanda-600 text-white font-semibold shadow-sm"
                  : isToday
                    ? "ring-1 ring-lavanda-300 text-lavanda-700 font-medium"
                    : "",
              )}
              title={formatLong(iso)}
            >
              {Number(iso.split("-")[2])}
            </button>
          );
        })}
      </div>
    </div>
  );
}
