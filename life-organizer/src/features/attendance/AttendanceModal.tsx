"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import type { SessionWithSubject } from "@/features/schedule/queries";
import { ATTENDANCE_META, type AttendanceStatus } from "@/types/domain";
import { formatLong } from "@/lib/dates";

interface AttendanceModalProps {
  open: boolean;
  session: SessionWithSubject | null;
  initialDate: string;
  initialStatus: AttendanceStatus | null;
  onClose: () => void;
  onSave: (sessionId: string, date: string, status: AttendanceStatus) => void;
  onDelete?: (sessionId: string, date: string) => void;
  loading?: boolean;
}

export function AttendanceModal({
  open,
  session,
  initialDate,
  initialStatus,
  onClose,
  onSave,
  onDelete,
  loading,
}: AttendanceModalProps) {
  const [date, setDate] = useState(initialDate);
  const [status, setStatus] = useState<AttendanceStatus | null>(initialStatus);

  // Sincronizar cuando cambia la sesión o la fecha inicial.
  useEffect(() => {
    setDate(initialDate);
    setStatus(initialStatus);
  }, [initialDate, initialStatus, session?.id]);

  if (!session) return null;

  const canDelete = Boolean(initialStatus && onDelete);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Asistencia · ${session.subject_name}`}
    >
      <div className="space-y-5">
        {/* Detalle de la sesión */}
        <div className="rounded-xl bg-lila-50 p-3 text-sm">
          <p className="font-medium text-lila-900">
            {session.start_time.slice(0, 5)}–{session.end_time.slice(0, 5)}
          </p>
          <p className="text-lila-500">{session.room || "Sin aula"}</p>
        </div>

        {/* Fecha */}
        <div>
          <label className="block text-xs font-medium text-lila-600 mb-2">
            Fecha: {formatLong(date)}
          </label>
          <DatePicker value={date} onChange={setDate} />
        </div>

        {/* Estado */}
        <div>
          <label className="block text-xs font-medium text-lila-600 mb-2">
            Estado
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["asisti", "Asistí"],
                ["falta", "Falta"],
                ["no_hubo", "No hubo"],
              ] as [AttendanceStatus, string][]
            ).map(([key, label]) => {
              const meta = ATTENDANCE_META[key];
              const active = status === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatus(key)}
                  className={`py-2 px-1 rounded-xl border text-sm font-medium transition-colors ${
                    active
                      ? meta.active
                      : "bg-white border-lila-200 text-lila-600 hover:bg-lila-50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          {canDelete && (
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => onDelete?.(session.id, date)}
              disabled={loading}
            >
              Borrar
            </Button>
          )}
          <Button
            className="flex-1"
            onClick={() => {
              if (status) onSave(session.id, date, status);
            }}
            disabled={!status || loading}
          >
            {loading ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
