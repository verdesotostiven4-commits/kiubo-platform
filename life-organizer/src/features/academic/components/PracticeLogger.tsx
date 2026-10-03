"use client";

import { useState } from "react";
import { Plus, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { DatePicker } from "@/components/ui/DatePicker";
import type { PracticeLog } from "@/features/academic/queries";
import { createPractice, deletePractice } from "@/features/academic/queries";
import { formatShort } from "@/lib/dates";

interface PracticeLoggerProps {
  initialPractices: PracticeLog[];
}

export function PracticeLogger({ initialPractices }: PracticeLoggerProps) {
  const [practices, setPractices] = useState(initialPractices);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [hours, setHours] = useState("2");
  const [description, setDescription] = useState("");

  const totalHours = practices.reduce((s, p) => s + p.hours, 0);

  const handleSave = async () => {
    const hrs = parseFloat(hours);
    if (hrs <= 0 || !description.trim()) return;

    // 1. Inserción optimista inmediata.
    const tempId = `temp-${Date.now()}`;
    const optimistic: PracticeLog = {
      id: tempId,
      practice_date: date,
      description: description.trim(),
      hours: hrs,
      created_at: new Date().toISOString(),
    };
    setPractices((prev) => [optimistic, ...prev]);
    setOpen(false);
    setDescription("");

    // 2. Sincronizar con Supabase; rollback si falla.
    try {
      await createPractice({
        practice_date: date,
        description: optimistic.description,
        hours: hrs,
      });
    } catch (err) {
      console.error("Error al registrar práctica:", err);
      setPractices((prev) => prev.filter((p) => p.id !== tempId));
    }
  };

  const handleDelete = async (id: string) => {
    const backup = practices.find((p) => p.id === id);
    setPractices((prev) => prev.filter((p) => p.id !== id));
    try {
      await deletePractice(id);
    } catch (err) {
      console.error("Error al borrar práctica:", err);
      if (backup) setPractices((prev) => [backup, ...prev]);
    }
  };

  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-lavanda-600" />
            <h3 className="text-sm font-semibold text-lila-900">
              Prácticas laborales
            </h3>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-lila-400 mb-3">
          {practices.length} registros · {totalHours}h totales
        </p>

        {practices.length === 0 ? (
          <p className="text-sm text-lila-400 text-center py-4">
            Sin prácticas registradas.
          </p>
        ) : (
          <div className="space-y-1.5">
            {practices.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 py-1.5 px-1 rounded-lg hover:bg-lila-50/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-lila-900 truncate">
                    {p.description}
                  </p>
                  <p className="text-[10px] text-lila-400">
                    {formatShort(p.practice_date)}
                  </p>
                </div>
                <span className="text-sm font-bold text-lavanda-600 shrink-0">
                  {p.hours}h
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  className="p-1.5 rounded-lg text-lila-300 hover:bg-rose-50 hover:text-rose-500 transition-colors shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardBody>

      <Modal open={open} onClose={() => setOpen(false)} title="Nueva práctica">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-lila-600 mb-2">
              Fecha
            </label>
            <DatePicker value={date} onChange={setDate} />
          </div>
          <div>
            <label className="block text-xs font-medium text-lila-600 mb-1.5">
              Horas
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-lila-200 text-sm text-lila-900 focus:outline-none focus:ring-2 focus:ring-lavanda-400 focus:border-lavanda-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-lila-600 mb-1.5">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="¿Qué hiciste en la práctica?"
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-lila-200 text-sm text-lila-900 placeholder:text-lila-300 focus:outline-none focus:ring-2 focus:ring-lavanda-400 focus:border-lavanda-400 resize-none"
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
              disabled={!parseFloat(hours) || !description.trim()}
            >
              Registrar
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
