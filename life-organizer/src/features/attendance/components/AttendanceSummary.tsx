"use client";

import { Card, CardBody } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ATTENDANCE_THRESHOLD, formatPercent } from "@/config/finance";
import { cn } from "@/lib/utils";

interface SubjectAttendance {
  subject_id: string;
  subject_name: string;
  attended: number;
  missed: number;
  cancelled: number;
  attendance_pct: number | null;
}

interface AttendanceSummaryProps {
  data: SubjectAttendance[];
}

export function AttendanceSummary({ data }: AttendanceSummaryProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-lila-500">
            Aún no hay registros de asistencia. Marca tus primeras clases para
            ver el porcentaje por materia.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <h3 className="text-sm font-semibold text-lila-900 mb-4">
          Asistencia por materia
        </h3>
        <div className="space-y-4">
          {data.map((subject) => {
            const pct = subject.attendance_pct ?? 0;
            const ok = pct >= ATTENDANCE_THRESHOLD;
            return (
              <div key={subject.subject_id}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-lila-700 truncate flex-1">
                    {subject.subject_name}
                  </p>
                  <span
                    className={cn(
                      "text-xs font-semibold ml-2",
                      ok ? "text-emerald-600" : "text-rose-500",
                    )}
                  >
                    {formatPercent(subject.attendance_pct)}
                  </span>
                </div>
                <ProgressBar
                  value={pct}
                  tone={ok ? "emerald" : "rose"}
                  className="h-1.5"
                />
                <p className="text-[10px] text-lila-400 mt-1">
                  {subject.attended} asistidas · {subject.missed} faltas ·{" "}
                  {subject.cancelled} no hubo
                </p>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
