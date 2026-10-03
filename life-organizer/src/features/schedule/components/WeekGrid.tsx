"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { SessionWithSubject } from "@/features/schedule/queries";
import { SessionCard } from "./SessionCard";
import { DOW_LABELS, addDays, formatShort } from "@/lib/dates";
import type { AttendanceStatus } from "@/types/domain";

interface WeekGridProps {
  currentMonday: string;
  today: string;
  onChangeWeek: (delta: number) => void;
  sessions: SessionWithSubject[];
  attendance: Map<string, AttendanceStatus>;
  onSessionClick: (session: SessionWithSubject, date: string) => void;
}

const WEEK_DAYS: (1 | 2 | 3 | 4 | 5)[] = [1, 2, 3, 4, 5];

export function WeekGrid({
  currentMonday,
  today,
  onChangeWeek,
  sessions,
  attendance,
  onSessionClick,
}: WeekGridProps) {
  const days = WEEK_DAYS.map((dow) => ({
    dow,
    iso: addDays(currentMonday, dow - 1),
    label: DOW_LABELS[dow - 1],
  }));

  return (
    <div className="space-y-4">
      {/* Header de navegación de semana */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => onChangeWeek(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold text-lila-900">
            Semana del {formatShort(currentMonday)}
          </p>
          <p className="text-xs text-lila-400">
            {formatShort(currentMonday)} – {formatShort(addDays(currentMonday, 6))}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onChangeWeek(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Grilla de días */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {days.map(({ dow, iso, label }) => {
          const daySessions = sessions.filter((s) => s.day_of_week === dow);
          const isToday = iso === today;

          return (
            <div
              key={dow}
              className="rounded-2xl border border-lila-100 bg-white/60 p-3 min-h-[160px]"
            >
              <div className="mb-3 text-center">
                <p
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wide",
                    isToday ? "text-lavanda-600" : "text-lila-400",
                  )}
                >
                  {label.slice(0, 3)}
                </p>
                <p
                  className={cn(
                    "text-sm font-medium",
                    isToday ? "text-lavanda-700" : "text-lila-700",
                  )}
                >
                  {formatShort(iso)}
                </p>
              </div>

              <div className="space-y-2">
                {daySessions.length === 0 && (
                  <p className="text-xs text-lila-300 text-center py-4">
                    Sin clases
                  </p>
                )}
                {daySessions.map((session) => {
                  const key = `${session.id}:${iso}`;
                  const status = attendance.get(key) ?? null;
                  return (
                    <SessionCard
                      key={session.id}
                      session={session}
                      date={iso}
                      status={status}
                      onClick={onSessionClick}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
