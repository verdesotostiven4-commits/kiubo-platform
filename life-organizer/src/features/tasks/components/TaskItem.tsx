"use client";

import { Check, Trash2 } from "lucide-react";
import type { Task } from "@/features/tasks/queries";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { formatShort } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { TaskCategory } from "@/types/domain";

interface TaskItemProps {
  task: Task;
  onToggle: (id: string, completed: boolean) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  estudio: "Estudio",
  personal: "Personal",
  deseos: "Deseos",
};

const CATEGORY_COLORS: Record<TaskCategory, string> = {
  estudio: "bg-lavanda-50 text-lavanda-700",
  personal: "bg-emerald-50 text-emerald-700",
  deseos: "bg-rose-50 text-rose-600",
};

export function TaskItem({ task, onToggle, onEdit, onDelete }: TaskItemProps) {
  const overdue =
    task.due_date && !task.completed && task.due_date < new Date().toISOString().slice(0, 10);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 transition-all",
        task.completed
          ? "border-lila-50 bg-lila-50/30 opacity-60"
          : "border-lila-100 bg-white hover:border-lavanda-200 hover:shadow-sm",
      )}
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={() => onToggle(task.id, !task.completed)}
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 transition-all",
          "flex items-center justify-center",
          task.completed
            ? "bg-emerald-500 border-emerald-500"
            : "border-lila-200 hover:border-lavanda-400",
        )}
      >
        {task.completed && <Check className="h-3 w-3 text-white" />}
      </button>

      {/* Contenido */}
      <button
        type="button"
        onClick={() => onEdit(task)}
        className="flex-1 text-left min-w-0"
      >
        <p
          className={cn(
            "text-sm font-medium truncate",
            task.completed
              ? "text-lila-400 line-through"
              : "text-lila-900",
          )}
        >
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span
            className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded",
              CATEGORY_COLORS[task.category],
            )}
          >
            {CATEGORY_LABELS[task.category]}
          </span>
          {task.subject_name && (
            <span className="text-[10px] text-lila-400 truncate max-w-[120px]">
              {task.subject_name}
            </span>
          )}
          {task.due_date && (
            <span
              className={cn(
                "text-[10px] font-medium",
                overdue ? "text-rose-500" : "text-lila-400",
              )}
            >
              {formatShort(task.due_date)}
            </span>
          )}
        </div>
      </button>

      {/* Prioridad + acciones */}
      <div className="flex items-center gap-1.5 shrink-0">
        <PriorityBadge priority={task.priority} variant="dot" />
        <button
          type="button"
          onClick={() => onDelete(task.id)}
          className="p-1.5 rounded-lg text-lila-300 hover:bg-rose-50 hover:text-rose-500 transition-colors"
          title="Eliminar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
