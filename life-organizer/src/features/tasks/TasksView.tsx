"use client";

import { useState, useMemo } from "react";
import { Plus, ListChecks } from "lucide-react";
import type { Task, SubjectOption } from "@/features/tasks/queries";
import {
  createTask,
  updateTask,
  toggleTask,
  deleteTask,
} from "@/features/tasks/queries";
import { TaskItem } from "./components/TaskItem";
import { TaskForm } from "./components/TaskForm";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import type { TaskCategory, Priority } from "@/types/domain";
import { cn } from "@/lib/utils";

interface TasksViewProps {
  initialTasks: Task[];
  subjects: SubjectOption[];
}

type Filter = "todas" | TaskCategory | "pendientes" | "completadas";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "pendientes", label: "Pendientes" },
  { key: "completadas", label: "Hechas" },
  { key: "estudio", label: "Estudio" },
  { key: "personal", label: "Personal" },
  { key: "deseos", label: "Deseos" },
];

export function TasksView({ initialTasks, subjects }: TasksViewProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks ?? []);
  const [filter, setFilter] = useState<Filter>("todas");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    switch (filter) {
      case "pendientes":
        return tasks.filter((t) => !t.completed);
      case "completadas":
        return tasks.filter((t) => t.completed);
      case "estudio":
      case "personal":
      case "deseos":
        return tasks.filter((t) => t.category === filter);
      default:
        return tasks;
    }
  }, [tasks, filter]);

  const pendingCount = tasks.filter((t) => !t.completed).length;

  const handleCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleEdit = (task: Task) => {
    setEditing(task);
    setFormOpen(true);
  };

  const handleSave = async (input: {
    title: string;
    category: TaskCategory;
    subject_id?: string | null;
    priority: Priority;
    due_date?: string | null;
  }) => {
    setLoading(true);
    try {
      if (editing) {
        // Actualización optimista de edición
        setTasks((prev) =>
          prev.map((t) =>
            t.id === editing.id
              ? {
                  ...t,
                  ...input,
                  subject_name:
                    input.subject_id && subjects
                      ? subjects.find((s) => s.id === input.subject_id)?.name ?? null
                      : null,
                }
              : t,
          ),
        );
        await updateTask(editing.id, input);
      } else {
        // CREACIÓN OPTIMISTA SIN RECARGA (0ms de latencia)
        const tempId = `temp-${Date.now()}`;
        const optimisticTask: Task = {
          id: tempId,
          title: input.title,
          category: input.category,
          subject_id: input.subject_id ?? null,
          subject_name:
            input.subject_id && subjects
              ? subjects.find((s) => s.id === input.subject_id)?.name ?? null
              : null,
          priority: input.priority,
          due_date: input.due_date ?? null,
          completed: false,
          completed_at: null,
          created_at: new Date().toISOString(),
        };

        // Insertar instantáneamente en la pantalla.
        setTasks((prev) => [optimisticTask, ...prev]);

        // Guardar en Supabase en segundo plano; rollback si falla.
        try {
          await createTask(input);
        } catch (err) {
          console.error("Error al crear tarea:", err);
          setTasks((prev) => prev.filter((t) => t.id !== tempId));
        }
      }
    } catch (err) {
      console.error("Error al guardar tarea:", err);
    } finally {
      setLoading(false);
      setFormOpen(false);
    }
  };

  const handleToggle = async (id: string, completed: boolean) => {
    // Cambio visual inmediato
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              completed,
              completed_at: completed ? new Date().toISOString() : null,
            }
          : t,
      ),
    );
    try {
      await toggleTask(id, completed);
    } catch (err) {
      console.error("Error al alternar tarea:", err);
      // Rollback si falla
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, completed: !completed } : t,
        ),
      );
    }
  };

  const handleDelete = async (id: string) => {
    const backup = [...tasks];
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await deleteTask(id);
    } catch (err) {
      console.error("Error al borrar tarea:", err);
      setTasks(backup);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header + botón */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-lila-500">
            {pendingCount} pendiente{pendingCount === 1 ? "" : "s"} ·{" "}
            {tasks.length - pendingCount} completada
            {tasks.length - pendingCount === 1 ? "" : "s"}
          </p>
        </div>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="h-4 w-4" />
          Nueva
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
              filter === f.key
                ? "bg-lavanda-100 text-lavanda-700"
                : "text-lila-500 hover:bg-lila-50",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <ListChecks className="h-8 w-8 mx-auto text-lila-300 mb-2" />
            <p className="text-sm text-lila-400">
              {filter === "todas"
                ? "Aún no tienes tareas. Crea la primera con el botón Nueva."
                : "No hay tareas en este filtro."}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <TaskForm
        open={formOpen}
        initialTask={editing}
        subjects={subjects}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        loading={loading}
      />
    </div>
  );
}