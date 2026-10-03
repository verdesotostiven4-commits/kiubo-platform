"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import type { Task, SubjectOption } from "@/features/tasks/queries";
import { PRIORITY_META, type Priority, type TaskCategory } from "@/types/domain";

interface TaskFormProps {
  open: boolean;
  initialTask: Task | null;
  subjects: SubjectOption[];
  onClose: () => void;
  onSave: (input: {
    title: string;
    category: TaskCategory;
    subject_id?: string | null;
    priority: Priority;
    due_date?: string | null;
  }) => void;
  loading?: boolean;
}

const CATEGORY_OPTIONS = [
  { value: "estudio", label: "Estudio" },
  { value: "personal", label: "Personal" },
  { value: "deseos", label: "Deseos" },
];

const PRIORITY_OPTIONS = (
  Object.entries(PRIORITY_META) as [string, { label: string }][]
)
  .sort((a, b) => Number(b[0]) - Number(a[0]))
  .map(([key, meta]) => ({
    value: key,
    label: `P${key} · ${meta.label}`,
  }));

export function TaskForm({
  open,
  initialTask,
  subjects,
  onClose,
  onSave,
  loading,
}: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TaskCategory>("estudio");
  const [subjectId, setSubjectId] = useState<string>("");
  const [priority, setPriority] = useState<Priority>(3);
  const [dueDate, setDueDate] = useState<string>("");

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title);
      setCategory(initialTask.category);
      setSubjectId(initialTask.subject_id ?? "");
      setPriority(initialTask.priority);
      setDueDate(initialTask.due_date ?? "");
    } else {
      setTitle("");
      setCategory("estudio");
      setSubjectId("");
      setPriority(3);
      setDueDate("");
    }
  }, [initialTask, open]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      category,
      subject_id: category === "estudio" && subjectId ? subjectId : null,
      priority,
      due_date: dueDate || null,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialTask ? "Editar tarea" : "Nueva tarea"}
    >
      <div className="space-y-4">
        {/* Título */}
        <div>
          <label className="block text-xs font-medium text-lila-600 mb-1.5">
            Tarea
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="¿Qué hay que hacer?"
            autoFocus
            className="w-full h-10 px-3 rounded-xl border border-lila-200 text-sm text-lila-900 placeholder:text-lila-300 focus:outline-none focus:ring-2 focus:ring-lavanda-400 focus:border-lavanda-400"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </div>

        {/* Categoría */}
        <div>
          <label className="block text-xs font-medium text-lila-600 mb-1.5">
            Categoría
          </label>
          <Select
            value={category}
            options={CATEGORY_OPTIONS}
            onChange={(v) => setCategory(v as TaskCategory)}
          />
        </div>

        {/* Materia (solo si es estudio) */}
        {category === "estudio" && subjects.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-lila-600 mb-1.5">
              Materia (opcional)
            </label>
            <Select
              value={subjectId}
              onChange={setSubjectId}
              placeholder="Sin materia específica"
              options={[
                { value: "", label: "Sin materia específica" },
                ...subjects.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
        )}

        {/* Prioridad */}
        <div>
          <label className="block text-xs font-medium text-lila-600 mb-1.5">
            Prioridad
          </label>
          <Select
            value={String(priority)}
            options={PRIORITY_OPTIONS}
            onChange={(v) => setPriority(Number(v) as Priority)}
          />
        </div>

        {/* Fecha límite */}
        <div>
          <label className="block text-xs font-medium text-lila-600 mb-2">
            Fecha límite {dueDate ? "" : "(opcional)"}
          </label>
          <DatePicker value={dueDate || "2026-10-01"} onChange={setDueDate} />
          {dueDate && (
            <button
              type="button"
              onClick={() => setDueDate("")}
              className="mt-1 text-xs text-lila-400 hover:text-rose-500 transition-colors"
            >
              Quitar fecha
            </button>
          )}
        </div>

        {/* Acciones */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={!title.trim() || loading}
          >
            {loading ? "Guardando…" : initialTask ? "Actualizar" : "Crear"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
