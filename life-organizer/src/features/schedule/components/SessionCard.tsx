"use client";

import type { SessionWithSubject } from "@/features/schedule/queries";
import type { AttendanceStatus } from "@/types/domain";
import { ATTENDANCE_META } from "@/types/domain";
import { cn } from "@/lib/utils";

interface SessionCardProps {
  session: SessionWithSubject;
  date: string;
  status?: AttendanceStatus | null;
  onClick: (session: SessionWithSubject, date: string) => void;
}

export function SessionCard({ session, date, status, onClick }: SessionCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(session, date)}
      className={cn(
        "w-full text-left rounded-xl border p-3 transition-all hover:shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-lavanda-400",
        status
          ? ATTENDANCE_META[status].active
          : "bg-white border-lila-100 hover:border-lavanda-300",
      )}
    >
      <p className={cn("text-sm font-semibold", status ? "text-white" : "text-lila-900")}>
        {session.start_time.slice(0, 5)}–{session.end_time.slice(0, 5)}
      </p>
      <p className={cn("text-xs mt-0.5", status ? "text-white/90" : "text-lila-600")}>
        {session.subject_name}
      </p>
      {session.room && (
        <p className={cn("text-xs mt-1", status ? "text-white/80" : "text-lila-400")}>
          {session.room}
        </p>
      )}
      {status && (
        <p className="text-[10px] font-medium uppercase tracking-wide mt-2 text-white/90">
          {ATTENDANCE_META[status].label}
        </p>
      )}
    </button>
  );
}
