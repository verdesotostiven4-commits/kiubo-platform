"use client";

import { useState } from "react";
import { Plus, Trash2, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import type { ExamGrade } from "@/features/academic/queries";
import type { SubjectOption } from "@/features/academic/queries";
import { createExamGrade, deleteExamGrade } from "@/features/academic/queries";
import { formatShort } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface ExamGradeListProps {
  initialGrades: ExamGrade[];
  subjects: SubjectOption[];
}

export function ExamGradeList({ initialGrades, subjects }: ExamGradeListProps) {
  const [grades, setGrades] = useState(initialGrades);
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState(
    subjects[0]?.id ?? "",
  );
  const [examName, setExamName] = useState("");
  const [grade, setGrade] = useState("");
  const [maxGrade, setMaxGrade] = useState("10");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const handleSave = async () => {
    const g = parseFloat(grade);
    const mx = parseFloat(maxGrade);
    if (!subjectId || !examName.trim() || g < 0 || mx <= 0) return;

    // 1. Inserción optimista inmediata.
    const tempId = `temp-${Date.now()}`;
    const subject = subjects.find((s) => s.id === subjectId);
    const optimistic: ExamGrade = {
      id: tempId,
      subject_id: subjectId,
      subject_name: subject?.name ?? "Materia",
      exam_name: examName.trim(),
      grade: g,
      max_grade: mx,
      exam_date: date,
      created_at: new Date().toISOString(),
    };
    setGrades((prev) => [optimistic, ...prev]);
    setOpen(false);
    setExamName("");
    setGrade("");

    // 2. Sincronizar con Supabase; rollback si falla.
    try {
      await createExamGrade({
        subject_id: subjectId,
        exam_name: optimistic.exam_name,
        grade: g,
        max_grade: mx,
        exam_date: date,
      });
    } catch (err) {
      console.error("Error al registrar nota:", err);
      setGrades((prev) => prev.filter((item) => item.id !== tempId));
    }
  };

  const handleDelete = async (id: string) => {
    const backup = grades.find((g) => g.id === id);
    setGrades((prev) => prev.filter((g) => g.id !== id));
    try {
      await deleteExamGrade(id);
    } catch (err) {
      console.error("Error al borrar nota:", err);
      if (backup) setGrades((prev) => [backup, ...prev]);
    }
  };

  const subjectOptions = subjects.map((s) => ({
    value: s.id,
    label: s.name,
  }));

  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-lavanda-600" />
            <h3 className="text-sm font-semibold text-lila-900">
              Notas de exámenes
            </h3>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setOpen(true)}
            disabled={subjects.length === 0}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {grades.length === 0 ? (
          <p className="text-sm text-lila-400 text-center py-4">
            Sin notas registradas.
          </p>
        ) : (
          <div className="space-y-1.5">
            {grades.map((g) => {
              const pct = (g.grade / g.max_grade) * 100;
              const passing = pct >= 70;
              return (
                <div
                  key={g.id}
                  className="flex items-center gap-3 py-1.5 px-1 rounded-lg hover:bg-lila-50/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-lila-900 truncate">
                      {g.exam_name}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-lila-400">
                      <span className="truncate">{g.subject_name}</span>
                      <span>·</span>
                      <span>{formatShort(g.exam_date)}</span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-bold shrink-0",
                      passing ? "text-emerald-600" : "text-rose-500",
                    )}
                  >
                    {g.grade.toFixed(1)}/{g.max_grade}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(g.id)}
                    className="p-1.5 rounded-lg text-lila-300 hover:bg-rose-50 hover:text-rose-500 transition-colors shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>

      <Modal open={open} onClose={() => setOpen(false)} title="Nueva nota">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-lila-600 mb-1.5">
              Materia
            </label>
            <Select
              value={subjectId}
              options={subjectOptions}
              onChange={setSubjectId}
              placeholder="Selecciona…"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-lila-600 mb-1.5">
              Nombre del examen
            </label>
            <input
              type="text"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              placeholder="Ej: Primer parcial"
              className="w-full h-10 px-3 rounded-xl border border-lila-200 text-sm text-lila-900 placeholder:text-lila-300 focus:outline-none focus:ring-2 focus:ring-lavanda-400 focus:border-lavanda-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-lila-600 mb-1.5">
                Nota
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="8.5"
                className="w-full h-10 px-3 rounded-xl border border-lila-200 text-sm text-lila-900 placeholder:text-lila-300 focus:outline-none focus:ring-2 focus:ring-lavanda-400 focus:border-lavanda-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-lila-600 mb-1.5">
                Nota máxima
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                value={maxGrade}
                onChange={(e) => setMaxGrade(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-lila-200 text-sm text-lila-900 focus:outline-none focus:ring-2 focus:ring-lavanda-400 focus:border-lavanda-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-lila-600 mb-2">
              Fecha del examen
            </label>
            <DatePicker value={date} onChange={setDate} />
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
              disabled={
                !subjectId ||
                !examName.trim() ||
                !parseFloat(grade) ||
                !parseFloat(maxGrade)
              }
            >
              Registrar
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
