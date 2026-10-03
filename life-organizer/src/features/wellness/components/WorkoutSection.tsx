"use client";

import { useState } from "react";
import { Plus, Dumbbell, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Card, CardBody } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import type { WorkoutLog } from "@/features/wellness/queries";
import { createWorkout, deleteWorkout } from "@/features/wellness/queries";
import { MUSCLE_GROUPS } from "@/config/finance";
import { formatShort, toISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { MuscleGroup } from "@/types/domain";

interface WorkoutSectionProps {
  initialWorkouts: WorkoutLog[];
}

const MUSCLE_OPTIONS = MUSCLE_GROUPS.map((g) => ({ value: g, label: g }));

export function WorkoutSection({ initialWorkouts }: WorkoutSectionProps) {
  const [workouts, setWorkouts] = useState(initialWorkouts);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(toISODate());
  const [minutes, setMinutes] = useState("30");
  const [group, setGroup] = useState<MuscleGroup>(MUSCLE_GROUPS[0]);
  const [note, setNote] = useState("");

  const handleSave = async () => {
    const mins = parseInt(minutes);
    if (mins <= 0) return;

    // 1. Inserción optimista inmediata.
    const tempId = `temp-${Date.now()}`;
    const optimistic: WorkoutLog = {
      id: tempId,
      workout_date: date,
      minutes: mins,
      muscle_group: group,
      note: note.trim(),
      created_at: new Date().toISOString(),
    };
    setWorkouts((prev) => [optimistic, ...prev]);
    setOpen(false);
    setNote("");

    // 2. Sincronizar con Supabase; rollback si falla.
    try {
      await createWorkout({
        workout_date: date,
        minutes: mins,
        muscle_group: group,
        note: optimistic.note,
      });
    } catch (err) {
      console.error("Error al registrar entrenamiento:", err);
      setWorkouts((prev) => prev.filter((w) => w.id !== tempId));
    }
  };

  const handleDelete = async (id: string) => {
    const backup = workouts.find((w) => w.id === id);
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
    try {
      await deleteWorkout(id);
    } catch (err) {
      console.error("Error al borrar entrenamiento:", err);
      if (backup) setWorkouts((prev) => [backup, ...prev]);
    }
  };

  const totalMinutes = workouts.reduce((s, w) => s + w.minutes, 0);

  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-lavanda-600" />
            <h3 className="text-sm font-semibold text-lila-900">
              Entrenamientos
            </h3>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-lila-400 mb-3">
          {workouts.length} sesiones · {totalMinutes} min totales
        </p>

        {workouts.length === 0 ? (
          <p className="text-sm text-lila-400 text-center py-4">
            Sin entrenamientos registrados.
          </p>
        ) : (
          <div className="space-y-1.5">
            {workouts.map((w) => (
              <div
                key={w.id}
                className="flex items-center gap-3 py-1.5 px-1 rounded-lg hover:bg-lila-50/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-lila-900">
                    {w.muscle_group}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-lila-400">
                    <span>{formatShort(w.workout_date)}</span>
                    {w.note && (
                      <>
                        <span>·</span>
                        <span className="truncate">{w.note}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-sm font-bold text-lavanda-600 shrink-0">
                  {w.minutes}m
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(w.id)}
                  className="p-1.5 rounded-lg text-lila-300 hover:bg-rose-50 hover:text-rose-500 transition-colors shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardBody>

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo entrenamiento">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-lila-600 mb-2">
              Fecha
            </label>
            <DatePicker value={date} onChange={setDate} />
          </div>
          <div>
            <label className="block text-xs font-medium text-lila-600 mb-1.5">
              Grupo muscular
            </label>
            <Select
              value={group}
              options={MUSCLE_OPTIONS}
              onChange={(v) => setGroup(v as MuscleGroup)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-lila-600 mb-1.5">
              Minutos
            </label>
            <input
              type="number"
              min="1"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-lila-200 text-sm text-lila-900 focus:outline-none focus:ring-2 focus:ring-lavanda-400 focus:border-lavanda-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-lila-600 mb-1.5">
              Nota (opcional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="¿Cómo te sentiste?"
              className="w-full h-10 px-3 rounded-xl border border-lila-200 text-sm text-lila-900 placeholder:text-lila-300 focus:outline-none focus:ring-2 focus:ring-lavanda-400 focus:border-lavanda-400"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={!parseInt(minutes)}
            >
              Registrar
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
