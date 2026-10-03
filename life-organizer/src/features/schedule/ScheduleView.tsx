"use client";

import { useEffect, useMemo, useState } from "react";
import type { SessionWithSubject } from "@/features/schedule/queries";
import {
  getAttendanceRange,
  saveAttendance,
  deleteAttendance,
  type AttendanceRecord,
} from "@/features/attendance/queries";
import { AttendanceSummary } from "@/features/attendance/components/AttendanceSummary";
import { AttendanceModal } from "@/features/attendance/AttendanceModal";
import { WeekGrid } from "./components/WeekGrid";
import { addDays, mondayOf, toISODate } from "@/lib/dates";
import type { AttendanceStatus } from "@/types/domain";

interface ScheduleViewProps {
  sessions: SessionWithSubject[];
  initialSummary: {
    subject_id: string;
    subject_name: string;
    attended: number;
    missed: number;
    cancelled: number;
    attendance_pct: number | null;
  }[];
  initialAttendance: AttendanceRecord[];
}

type SummaryItem = {
  subject_id: string;
  subject_name: string;
  attended: number;
  missed: number;
  cancelled: number;
  attendance_pct: number | null;
};

function recordsToMap(records: AttendanceRecord[]): Map<string, AttendanceStatus> {
  return new Map(records.map((r) => [`${r.session_id}:${r.session_date}`, r.status]));
}

/** Ajusta el resumen local tras un cambio de estado de asistencia (sin re-fetch). */
function adjustSummary(
  summary: SummaryItem[],
  subjectId: string | undefined,
  oldStatus: AttendanceStatus | null,
  newStatus: AttendanceStatus | null,
): SummaryItem[] {
  if (!subjectId) return summary;
  return summary.map((s) => {
    if (s.subject_id !== subjectId) return s;
    let { attended, missed, cancelled } = s;
    // Quitar el estado anterior.
    if (oldStatus === "asisti") attended -= 1;
    else if (oldStatus === "falta") missed -= 1;
    else if (oldStatus === "no_hubo") cancelled -= 1;
    // Sumar el nuevo estado.
    if (newStatus === "asisti") attended += 1;
    else if (newStatus === "falta") missed += 1;
    else if (newStatus === "no_hubo") cancelled += 1;
    const total = attended + missed;
    return {
      ...s,
      attended,
      missed,
      cancelled,
      attendance_pct: total > 0 ? Math.round((attended / total) * 100) : null,
    };
  });
}

export function ScheduleView({
  sessions,
  initialSummary,
  initialAttendance,
}: ScheduleViewProps) {
  const today = useMemo(() => toISODate(), []);
  const [currentMonday, setCurrentMonday] = useState(mondayOf(today));
  const [attendance, setAttendance] = useState(() =>
    recordsToMap(initialAttendance),
  );
  const [summary, setSummary] = useState<SummaryItem[]>(initialSummary);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalSession, setModalSession] = useState<SessionWithSubject | null>(null);
  const [modalDate, setModalDate] = useState(today);

  // Refrescar asistencia cuando cambia la semana visible.
  useEffect(() => {
    const start = currentMonday;
    const end = addDays(currentMonday, 6);
    getAttendanceRange(start, end).then((records) => {
      setAttendance(recordsToMap(records));
    });
  }, [currentMonday]);

  const handleSessionClick = (session: SessionWithSubject, date: string) => {
    setModalSession(session);
    setModalDate(date);
    setModalOpen(true);
  };

  const handleSave = async (
    sessionId: string,
    date: string,
    status: AttendanceStatus,
  ) => {
    const key = `${sessionId}:${date}`;
    const prevStatus = attendance.get(key) ?? null;
    const subjectId = modalSession?.subject_id;

    // 1. Actualización optimista inmediata en la grilla.
    const optimisticMap = new Map(attendance);
    optimisticMap.set(key, status);
    setAttendance(optimisticMap);

    // 2. Recalcular resumen local (sin re-fetch).
    setSummary((prev) => adjustSummary(prev, subjectId, prevStatus, status));

    // 3. Cerrar el modal instantáneamente (0 ms).
    setModalOpen(false);

    // 4. Sincronizar con Supabase en segundo plano; rollback si falla.
    try {
      await saveAttendance(sessionId, date, status);
    } catch (err) {
      console.error("Error al guardar asistencia:", err);
      const rollbackMap = new Map(attendance);
      if (prevStatus) {
        rollbackMap.set(key, prevStatus);
      } else {
        rollbackMap.delete(key);
      }
      setAttendance(rollbackMap);
      setSummary((prev) => adjustSummary(prev, subjectId, status, prevStatus));
    }
  };

  const handleDelete = async (sessionId: string, date: string) => {
    const key = `${sessionId}:${date}`;
    const prevStatus = attendance.get(key) ?? null;
    const subjectId = modalSession?.subject_id;

    // 1. Actualización optimista inmediata.
    const optimisticMap = new Map(attendance);
    optimisticMap.delete(key);
    setAttendance(optimisticMap);

    // 2. Recalcular resumen local.
    setSummary((prev) => adjustSummary(prev, subjectId, prevStatus, null));

    // 3. Cerrar el modal instantáneamente.
    setModalOpen(false);

    // 4. Sincronizar con Supabase; rollback si falla.
    try {
      await deleteAttendance(sessionId, date);
    } catch (err) {
      console.error("Error al borrar asistencia:", err);
      const rollbackMap = new Map(attendance);
      if (prevStatus) {
        rollbackMap.set(key, prevStatus);
      }
      setAttendance(rollbackMap);
      setSummary((prev) => adjustSummary(prev, subjectId, null, prevStatus));
    }
  };

  const handleChangeWeek = (delta: number) => {
    setCurrentMonday((m) => addDays(m, delta * 7));
  };

  const initialStatus = modalSession
    ? (attendance.get(`${modalSession.id}:${modalDate}`) ?? null)
    : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <WeekGrid
            currentMonday={currentMonday}
            onChangeWeek={handleChangeWeek}
            sessions={sessions}
            attendance={attendance}
            onSessionClick={handleSessionClick}
            today={today}
          />
        </div>
        <div>
          <AttendanceSummary data={summary} />
        </div>
      </div>

      <AttendanceModal
        open={modalOpen}
        session={modalSession}
        initialDate={modalDate}
        initialStatus={initialStatus}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={initialStatus ? handleDelete : undefined}
        loading={false}
      />
    </div>
  );
}
