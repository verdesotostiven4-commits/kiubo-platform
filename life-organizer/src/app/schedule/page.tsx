import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSchedule } from "@/features/schedule/queries";
import {
  getAttendanceRange,
  getAttendanceSummary,
} from "@/features/attendance/queries";
import { ScheduleView } from "@/features/schedule/ScheduleView";
import { mondayOf, toISODate, addDays } from "@/lib/dates";

export default async function SchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const today = toISODate();
  const monday = mondayOf(today);

  const [sessions, summary, attendance] = await Promise.all([
    getSchedule(),
    getAttendanceSummary(),
    getAttendanceRange(monday, addDays(monday, 6)),
  ]);

  return (
    <main className="flex-1 px-4 sm:px-6 py-6 max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-lila-950">Horario ESPOCH</h1>
        <p className="text-sm text-lila-500 mt-1">
          Toca una clase para marcar asistencia.
        </p>
      </div>

      <ScheduleView
        sessions={sessions}
        initialSummary={summary}
        initialAttendance={attendance}
      />
    </main>
  );
}
